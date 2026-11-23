import { Keypair } from "@solana/web3.js";
import { afterEach, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
vi.mock("@magicblock-labs/ephemeral-rollups-sdk", () => ({ getAuthToken: auth }));
import { teeAuthUrl } from "../src/tee.js";
import { baseConnection, teeConnection } from "../src/connection.js";
import { createConfig } from "../src/config.js";

afterEach(() => {
  vi.restoreAllMocks();
  auth.mockReset();
});

it("creates anonymous and authenticated TEE connections with matching websocket tokens", async () => {
  const config = createConfig({
    baseRpcUrl: "https://base.example",
    teeRpcUrl: "https://tee.example/path",
  });
  auth.mockResolvedValue({ token: "token-value", expiresAt: Date.now() + 60_000 });
  const base = baseConnection(config);
  expect(base.rpcEndpoint).toBe("https://base.example");
  const anonymous = await teeConnection(config);
  expect(anonymous.rpcEndpoint).toBe("https://tee.example/path");
  expect((anonymous as unknown as { _rpcWsEndpoint: string })._rpcWsEndpoint).toBe(
    "wss://tee.example/path",
  );
  const authenticated = await teeConnection(config, Keypair.generate());
  expect(authenticated.rpcEndpoint).toBe("https://tee.example/path?token=token-value");
  expect((authenticated as unknown as { _rpcWsEndpoint: string })._rpcWsEndpoint).toBe(
    "wss://tee.example/path?token=token-value",
  );
});

it("caches by endpoint and public key until expiry and supports wallet signers", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1_000);
  auth
    .mockResolvedValueOnce({ token: "first", expiresAt: 2_000 })
    .mockResolvedValueOnce({ token: "other", expiresAt: 2_000 })
    .mockResolvedValueOnce({ token: "second-key", expiresAt: 2_000 })
    .mockResolvedValueOnce({ token: "renewed", expiresAt: 3_000 });
  const key = Keypair.generate();
  const wallet = { publicKey: key.publicKey, signMessage: vi.fn(async () => new Uint8Array(64)) };
  const first = await teeAuthUrl("https://tee.example/", wallet);
  expect(first.url).toBe("https://tee.example/?token=first");
  expect(await teeAuthUrl("https://tee.example", wallet)).toEqual(first);
  expect(auth).toHaveBeenCalledTimes(1);
  await auth.mock.calls[0]![2](new Uint8Array([1]));
  expect(wallet.signMessage).toHaveBeenCalledOnce();
  await teeAuthUrl("https://other.example", wallet);
  await teeAuthUrl("https://tee.example", Keypair.generate());
  vi.spyOn(Date, "now").mockReturnValue(2_000);
  expect((await teeAuthUrl("https://tee.example", key)).token).toBe("renewed");
  expect(auth).toHaveBeenCalledTimes(4);
  const signature = await auth.mock.calls[3]![2](new Uint8Array([1]));
  expect(signature).toHaveLength(64);
});

it("bounds the token cache", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1_000);
  auth.mockResolvedValue({ token: "token", expiresAt: 2_000 });
  const key = Keypair.generate();
  for (let i = 0; i < 129; i++) await teeAuthUrl(`https://cache-${i}.example`, key);
  await teeAuthUrl("https://cache-0.example", key);
  expect(auth).toHaveBeenCalledTimes(130);
});
