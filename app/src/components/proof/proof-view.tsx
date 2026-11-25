import { ArrowUpRight } from "lucide-react";
import cupProof from "../../../../docs/proofs/cup.json";
import { Badge } from "@/components/ui/badge";
import { Stamp } from "@/components/ui/stamp";
import { explorerAddress, proofs, type GateEntry } from "@/lib/proofs";

const PROGRAM =
  process.env.NEXT_PUBLIC_INSIDER_PROGRAM_ID || "7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW";
const TABLE = "DjnqzKQsUU1fmRztBAiUkPn8VwsnFYgMedcg1BPyA1k";
const SOAR_PROGRAM = "SoarNNzwQHMwcfdkdLc6kvbkoMSxcHy89gTHrjhJYkk";

const tone = (status: string): "buy" | "opened" | "sell" =>
  status === "pass" ? "buy" : status === "info" ? "opened" : "sell";

const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-6)}`;

const groups: Array<{ name: string; ids: string[] }> = [
  {
    name: "Floor & privacy",
    ids: ["vertical-slice", "simulate-round", "privacy-test", "go-live", "soak"],
  },
  { name: "The Desk", ids: ["desk"] },
  { name: "Alpha Cup", ids: ["cup"] },
  { name: "Season & SOAR", ids: ["epoch", "soar"] },
  { name: "Sessions & recovery", ids: ["session", "teardown", "recovery"] },
];
const cupLinks = [
  ...cupProof.steps.flatMap((step) =>
    step.what.includes("joins the cup") && "signature" in step && step.signature
      ? [
          {
            label: step.what,
            url: `https://explorer.solana.com/tx/${step.signature}?cluster=custom&customUrl=${encodeURIComponent("https://devnet-tee.magicblock.app")}`,
          },
        ]
      : [],
  ),
  {
    label: "Cup closed after payouts",
    url: `https://explorer.solana.com/tx/${cupProof.payout.closed}?cluster=custom&customUrl=${encodeURIComponent("https://devnet-tee.magicblock.app")}`,
  },
];

function Gate({ gate }: { gate: GateEntry }) {
  return (
    <li className="border-line flex flex-col gap-1.5 border-b px-5 py-4 last:border-0 sm:flex-row sm:items-start sm:gap-5">
      <div className="flex w-52 shrink-0 items-center gap-3">
        <span className="text-faint font-mono text-[10px]">{gate.gate}</span>
        <span className="text-sm font-medium">{gate.name}</span>
      </div>
      <Badge tone={tone(gate.status)} className="self-start uppercase">
        {gate.status}
      </Badge>
      <p className="text-muted min-w-0 flex-1 text-sm leading-6">{gate.decision}</p>
    </li>
  );
}

export function ProofView() {
  const { entries, gates } = proofs;
  const other = entries.filter((entry) => !groups.some((group) => group.ids.includes(entry.id)));
  const featureGroups = [...groups, { name: "Other runs", ids: other.map((entry) => entry.id) }];
  const addresses: Array<[string, string, string]> = [
    [
      "Game program",
      PROGRAM,
      "Anchor program on devnet; the table accounts are delegated to the private rollup.",
    ],
    ["Table", TABLE, "The live table, delegated to the MagicBlock TEE validator."],
    [
      "SOAR program",
      SOAR_PROGRAM,
      "Season scores are published to a SOAR leaderboard after every epoch.",
    ],
  ];
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 lg:py-14">
      <div className="micro-label text-brand">Verify / Proof</div>
      <h1 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">
        Don&apos;t trust it. Check it.
      </h1>
      <p className="text-muted mt-3 max-w-2xl text-sm leading-6">
        These records describe runs on Solana devnet. Where transactions are recorded, base-layer
        links open in the Solana Explorer; private-rollup links use its custom-cluster view (a
        private read may show empty on purpose).
      </p>

      <section aria-labelledby="addresses" className="mt-10">
        <div className="micro-label">01 / Addresses</div>
        <h2 id="addresses" className="mt-2 text-xl font-medium">
          What is deployed
        </h2>
        <div className="border-line bg-surface mt-4 overflow-hidden rounded-lg border">
          {addresses.map(([label, address, note]) => (
            <a
              key={address}
              href={explorerAddress(address)}
              target="_blank"
              rel="noreferrer"
              className="border-line hover:bg-surface-2 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 last:border-0"
            >
              <span>
                <span className="text-sm font-medium">{label}</span>
                <span className="text-muted mt-1 block text-xs">{note}</span>
              </span>
              <span className="text-faint flex items-center gap-2 font-mono text-xs">
                {short(address)} <ArrowUpRight aria-hidden className="size-4" />
              </span>
            </a>
          ))}
        </div>
      </section>

      <section aria-labelledby="demos" className="mt-12">
        <div className="micro-label">02 / Live runs</div>
        <h2 id="demos" className="mt-2 text-xl font-medium">
          Scripts that ran against the live table
        </h2>
        {featureGroups.map((group) => {
          const grouped = entries.filter((entry) => group.ids.includes(entry.id));
          if (!grouped.length) return null;
          return (
            <section key={group.name} aria-label={group.name} className="mt-7">
              <h3 className="micro-label">{group.name}</h3>
              <div className="mt-3 grid gap-5 lg:grid-cols-2">
                {grouped.map((entry) => {
                  const failed = entry.checks.filter((check) => !check.pass).length;
                  const links = entry.id === "cup" ? [...entry.links, ...cupLinks] : entry.links;
                  return (
                    <article
                      key={entry.id}
                      className="border-ink bg-surface flex min-w-0 flex-col rounded-lg border-2"
                    >
                      <div className="border-line bg-surface-2 flex items-center justify-between gap-3 border-b border-dashed px-5 py-3">
                        <span className="text-muted min-w-0 truncate font-mono text-[10px] uppercase">
                          RECEIPT / {entry.id}
                        </span>
                        <Stamp
                          className={
                            failed
                              ? "text-sell shrink-0"
                              : entry.checks.length
                                ? "text-buy shrink-0"
                                : "text-muted shrink-0"
                          }
                        >
                          {failed ? "Failed" : entry.checks.length ? "Verified" : "Record"}
                        </Stamp>
                      </div>
                      <div className="p-5">
                        <h4 className="text-base font-bold">{entry.title}</h4>
                        <p className="text-muted mt-2 text-sm leading-6">{entry.summary}</p>
                        {entry.checks.length > 0 && (
                          <ul className="mt-3 space-y-1">
                            {entry.checks.slice(0, 6).map((check) => (
                              <li
                                key={check.name}
                                className="text-muted flex gap-2 text-xs leading-5"
                              >
                                <span className={check.pass ? "text-buy" : "text-sell"}>
                                  {check.pass ? "✓" : "✗"}
                                </span>
                                {check.name}
                              </li>
                            ))}
                          </ul>
                        )}
                        {links.length > 0 ? (
                          <details className="mt-4">
                            <summary className="text-brand cursor-pointer font-mono text-[10px] uppercase">
                              {links.length} transactions
                            </summary>
                            <ul className="mt-3 space-y-1.5">
                              {links.map((link) => (
                                <li key={link.url}>
                                  <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-muted hover:text-text flex items-start justify-between gap-3 text-xs leading-5"
                                  >
                                    <span className="min-w-0">{link.label}</span>
                                    <ArrowUpRight
                                      aria-hidden
                                      className="mt-0.5 size-3.5 shrink-0"
                                    />
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : entry.facts.table ? (
                          <a
                            href={explorerAddress(entry.facts.table)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-opened mt-4 inline-flex items-center gap-1 text-xs underline"
                          >
                            Table account <ArrowUpRight aria-hidden className="size-3" />
                          </a>
                        ) : (
                          <p className="text-faint mt-4 text-xs">
                            No explorer link recorded for this run.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </section>

      <section aria-labelledby="gates" className="mt-12">
        <div className="micro-label">03 / Decisions</div>
        <h2 id="gates" className="mt-2 text-xl font-medium">
          The risky bets, tested before building on them
        </h2>
        <ul className="border-line bg-surface mt-4 overflow-hidden rounded-lg border">
          {gates.map((gate) => (
            <Gate key={gate.gate} gate={gate} />
          ))}
        </ul>
      </section>
    </main>
  );
}
