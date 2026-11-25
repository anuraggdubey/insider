/**
 * One process for a host with a single public port (Render, Railway, Fly): runs the four services
 * (`bots`, `operator`, `cup-operator`, `analysts`), restarts any that exits, and serves
 *
 *   GET /health        200 when every service is running, 503 (with the list) when one is down
 *   GET /captions...   proxied to the caption feed (the analysts service, COMMENTARY_PORT 8788)
 *   GET|POST /cup/...  proxied to the Alpha Cup operator (CUP_PORT 8789)
 *
 * Point an uptime monitor at /health. Keys: set `KEYS_B64` (see `pnpm pack-keys`); they are written
 * under `.keys/` at boot. Everything else is the usual `.env` / environment.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ROOT } from "@insider/sdk/node";

const SERVICES = [
  { name: "bots", entry: "src/index.ts" },
  { name: "operator", entry: "src/operator.ts" },
  { name: "cup-operator", entry: "src/cup/index.ts" },
  { name: "analysts", entry: "src/ai/index.ts" },
] as const;

/** Built by `pnpm --filter bots build` (the Docker image): run each service as `node dist/<name>.mjs`. */
const BUILT = basename(fileURLToPath(import.meta.url)) === "host.mjs";
/** Heap cap per service in MB; four services and the host must fit in a 512 MB instance. */
const SERVICE_HEAP_MB = Number(process.env.SERVICE_HEAP_MB || 96);

const PORT = Number(process.env.PORT || 8080);
const COMMENTARY_PORT = Number(process.env.COMMENTARY_PORT || 8788);
const CUP_PORT = Number(process.env.CUP_PORT || 8789);

/** `KEYS_B64` is base64 of `{ "agents/bot-flow.json": [..secret key bytes..], ... }`. */
export function writeKeys(encoded: string | undefined, root = ROOT) {
  if (!encoded) return 0;
  const files = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as Record<
    string,
    unknown
  >;
  for (const [name, content] of Object.entries(files)) {
    if (name.includes("..") || name.startsWith("/")) throw new Error(`bad key path ${name}`);
    const path = resolve(root, ".keys", name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content), {
      mode: 0o600,
    });
  }
  return Object.keys(files).length;
}

type State = { child?: ChildProcess; running: boolean; restarts: number; since: number };
const state = new Map<string, State>();
let stopping = false;

function start(name: string, entry: string) {
  const s = state.get(name) ?? { running: false, restarts: 0, since: Date.now() };
  state.set(name, s);
  const child = BUILT
    ? spawn(
        process.execPath,
        [`--max-old-space-size=${SERVICE_HEAP_MB}`, resolve(ROOT, "bots/dist", `${name}.mjs`)],
        { cwd: resolve(ROOT, "bots"), env: process.env },
      )
    : spawn("pnpm", ["exec", "tsx", entry], {
        cwd: resolve(ROOT, "bots"),
        env: process.env,
        shell: process.platform === "win32",
      });
  s.child = child;
  s.running = true;
  s.since = Date.now();
  const pipe = (stream: NodeJS.ReadableStream | null, out: NodeJS.WriteStream) =>
    stream?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/))
        if (line) out.write(`[${name}] ${line}\n`);
    });
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    s.running = false;
    if (stopping) return;
    s.restarts += 1;
    // a service that dies at once is retried more slowly
    const delay = Date.now() - s.since < 20_000 ? 15_000 : 3_000;
    console.error(`[host] ${name} exited (${code}); restarting in ${delay / 1000} s`);
    setTimeout(() => start(name, entry), delay);
  });
}

function proxy(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  port: number,
) {
  const upstream = httpRequest(
    { host: "127.0.0.1", port, path: req.url, method: req.method, headers: req.headers },
    (reply) => {
      res.writeHead(reply.statusCode ?? 502, reply.headers);
      reply.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "service unavailable" }));
  });
  req.pipe(upstream);
}

function main() {
  const written = writeKeys(process.env.KEYS_B64);
  console.log(`[host] wrote ${written} key files`);
  for (const service of SERVICES) start(service.name, service.entry);

  createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0]!;
    if (req.method === "OPTIONS" && (path.startsWith("/captions") || path.startsWith("/cup"))) {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      res.end();
      return;
    }
    if (path === "/health" || path === "/") {
      const services = Object.fromEntries(
        [...state.entries()].map(([name, s]) => [
          name,
          {
            running: s.running,
            restarts: s.restarts,
            upSeconds: Math.round((Date.now() - s.since) / 1000),
          },
        ]),
      );
      const ok = SERVICES.every((service) => state.get(service.name)?.running);
      res.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok, services }));
    } else if (path.startsWith("/captions")) {
      proxy(req, res, COMMENTARY_PORT);
    } else if (path.startsWith("/cup")) {
      proxy(req, res, CUP_PORT);
    } else {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    }
  }).listen(PORT, () => console.log(`[host] listening on ${PORT}: /health, /captions, /cup/*`));

  const stop = () => {
    stopping = true;
    for (const s of state.values()) s.child?.kill();
    setTimeout(() => process.exit(0), 1_000);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

// only start the services when run directly (the test imports `writeKeys`)
if (process.argv[1] && /host\.(ts|js|mjs)$/.test(process.argv[1])) main();
