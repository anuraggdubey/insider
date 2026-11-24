"use client";

import { teeConnection } from "@insider/sdk";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useInsider } from "@/app/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { fetchDesk, type DeskCall, type DeskData } from "@/lib/desk";
import { buyDeskLicense, deskPlayerKey, mintDeskCall, tradeDesk } from "@/lib/desk-actions";
import { friendlyError } from "@/lib/errors";
import { useFloorStore } from "@/lib/floor-store";

const HORIZONS = [60, 120, 180] as const;
const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString("en-US")}`;

function remaining(call: DeskCall, now: number) {
  const left = call.expiresAt - Math.floor(now / 1000);
  return left > 0 ? `${left}s` : "judging…";
}

function CallRow({
  call,
  now,
  canBuy,
  busy,
  onBuy,
}: {
  call: DeskCall;
  now: number;
  canBuy: boolean;
  busy: boolean;
  onBuy: (call: DeskCall) => void;
}) {
  const open = call.state === "open";
  const buyable = open && canBuy && !call.mine && call.licenseAsk > 0 && call.readers < 4;
  return (
    <li className="border-line grid grid-cols-[1fr_auto] items-center gap-3 border-b px-4 py-3 last:border-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{call.author}</span>
          {call.mine && <span className="text-sealed font-mono text-[10px] uppercase">You</span>}
          {open ? (
            <Badge tone="sealed">Sealed</Badge>
          ) : (
            <Badge tone={call.state === "right" ? "buy" : "sell"}>
              {call.state === "right" ? "Right" : "Wrong"} · called {call.direction}
            </Badge>
          )}
        </div>
        <div className="text-faint mt-1 font-mono text-[10px]">
          #{call.callId} · {call.horizon}s · stake {call.stake} · from $
          {call.mintedPrice.toFixed(2)}
          {open && ` · ${call.readers} reader${call.readers === 1 ? "" : "s"}`}
          {open && ` · ${remaining(call, now)}`}
        </div>
      </div>
      {buyable && (
        <Button size="sm" variant="outline" loading={busy} onClick={() => onBuy(call)}>
          Read for {call.licenseAsk}
        </Button>
      )}
    </li>
  );
}

export function DeskView() {
  const config = useInsider();
  const walletKey = useFloorStore((state) => state.walletKey);
  const identity = useFloorStore((state) => state.identity);
  const guest = useFloorStore((state) => state.guest);
  const [data, setData] = useState<DeskData | null>(null);
  const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");
  const [now, setNow] = useState(() => Date.now());
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(60);
  const [stake, setStake] = useState(50);
  const [licenseAsk, setLicenseAsk] = useState(20);
  const me = useMemo(() => {
    void walletKey;
    void identity;
    void guest;
    return deskPlayerKey();
  }, [walletKey, identity, guest]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let closed = false;
    const load = async () => {
      try {
        const result = config.tableAuthority
          ? await fetchDesk(await teeConnection(config), config, me)
          : null;
        if (closed) return;
        setData(result);
        setStatus(result ? "online" : "offline");
      } catch {
        if (!closed) setStatus((current) => (current === "online" ? "online" : "offline"));
      }
    };
    void load();
    const timer = setInterval(load, 4_000);
    return () => {
      closed = true;
      clearInterval(timer);
    };
  }, [config, me, refresh]);

  const act = useCallback(async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    try {
      await action();
      setRefresh((value) => value + 1);
    } catch (error) {
      useToast.getState().add(friendlyError(error));
    } finally {
      setBusy(null);
    }
  }, []);

  const mySeat = data?.mySeat ?? null;
  const open = data?.calls.filter((call) => call.state === "open") ?? [];
  const judged = (data?.calls.filter((call) => call.state !== "open") ?? []).slice(0, 8);
  const myOpen = open.some((call) => call.mine);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="micro-label text-priority">Exchange / The Desk</div>
          <h1 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">Call the market.</h1>
          <p className="text-muted mt-3 max-w-xl text-sm leading-6">
            Commit to SOL up or down. The direction stays sealed until the oracle judges it; sell a
            licence and others can read it first. Right Calls return the stake plus 50%.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {data?.price != null && (
            <div className="text-right">
              <div className="micro-label">SOL / USD</div>
              <div className="font-mono text-2xl tabular-nums">${data.price.toFixed(2)}</div>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setRefresh((value) => value + 1)}>
            <RefreshCw aria-hidden className="size-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {status === "loading" && (
        <p role="status" className="text-muted mt-10 text-sm">
          Loading the Desk…
        </p>
      )}
      {status === "offline" && (
        <section
          className="border-line bg-surface mt-10 rounded-lg border p-7"
          aria-label="Desk offline"
        >
          <div className="micro-label">Desk / unavailable</div>
          <h2 className="mt-3 text-xl font-medium">The Desk is offline</h2>
          <p className="text-muted mt-2 max-w-xl text-sm leading-6">
            The table authority is not configured, the table is between seasons, or the private
            rollup could not be reached. Try again in a moment.
          </p>
        </section>
      )}

      {status === "online" && data && (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div className="min-w-0 space-y-8">
            <Panel title="Open Calls" label={`${open.length} sealed`}>
              {open.length ? (
                <ul>
                  {open.map((call) => (
                    <CallRow
                      key={call.callId}
                      call={call}
                      now={now}
                      canBuy={Boolean(mySeat)}
                      busy={busy === `buy-${call.seat}`}
                      onBuy={(target) =>
                        act(`buy-${target.seat}`, () =>
                          buyDeskLicense(config, mySeat!.index, target.seat),
                        )
                      }
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-muted p-5 text-sm">No open Calls. Be the first to commit.</p>
              )}
            </Panel>
            <Panel title="Judged" label="oracle verdicts">
              {judged.length ? (
                <ul>
                  {judged.map((call) => (
                    <CallRow
                      key={call.callId}
                      call={call}
                      now={now}
                      canBuy={false}
                      busy={false}
                      onBuy={() => {}}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-muted p-5 text-sm">Nothing judged yet.</p>
              )}
            </Panel>
            <Panel title="Analyst track record" label="public, per seat">
              {data.analysts.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="border-line text-faint border-b font-mono text-[10px] uppercase">
                      <tr>
                        <th className="p-4 font-normal">Seat</th>
                        <th className="p-3 text-right font-normal">Calls</th>
                        <th className="p-3 text-right font-normal">Hits</th>
                        <th className="p-3 text-right font-normal">Streak</th>
                        <th className="p-4 text-right font-normal">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.analysts.map((row) => (
                        <tr key={row.seat} className="border-line border-b last:border-0">
                          <td className="p-4">{row.name}</td>
                          <td className="text-muted p-3 text-right font-mono tabular-nums">
                            {row.calls}
                          </td>
                          <td className="text-muted p-3 text-right font-mono tabular-nums">
                            {row.hits}
                          </td>
                          <td className="text-muted p-3 text-right font-mono tabular-nums">
                            {row.streak}
                          </td>
                          <td
                            className={`p-4 text-right font-mono tabular-nums ${row.profit >= 0 ? "text-buy" : "text-sell"}`}
                          >
                            {signed(row.profit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted p-5 text-sm">No Calls have been judged this season.</p>
              )}
            </Panel>
          </div>

          <div className="min-w-0 space-y-8">
            <Panel title="Your Desk" label={mySeat ? `seat ${mySeat.index + 1}` : "no seat"}>
              {mySeat ? (
                <div className="space-y-5 p-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="micro-label">Desk chips</div>
                      <div className="mt-1 font-mono text-xl tabular-nums">{mySeat.deskChips}</div>
                    </div>
                    <div>
                      <div className="micro-label">Position (units)</div>
                      <div className="mt-1 font-mono text-xl tabular-nums">
                        {signed(mySeat.deskPosition)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {[100, -100].map((size) => (
                      <Button
                        key={size}
                        size="sm"
                        variant="outline"
                        loading={busy === `trade-${size}`}
                        onClick={() =>
                          act(`trade-${size}`, () => tradeDesk(config, mySeat.index, size))
                        }
                      >
                        {size > 0 ? "Buy" : "Sell"} {Math.abs(size)} units
                      </Button>
                    ))}
                  </div>
                  <p className="text-faint text-xs leading-5">
                    A unit is 1/100 SOL, filled at the oracle price with a 0.1% fee.
                  </p>
                </div>
              ) : (
                <p className="text-muted p-5 text-sm leading-6">
                  Take a seat on the floor first, then come back to make Calls and trade.
                </p>
              )}
            </Panel>

            <Panel title="Make a Call" label="one open Call per seat">
              <form
                className="space-y-4 p-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!mySeat) return;
                  void act("mint", () =>
                    mintDeskCall(config, mySeat.index, { direction, horizon, stake, licenseAsk }),
                  );
                }}
              >
                <div className="grid grid-cols-2 gap-2">
                  {([1, -1] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={direction === value}
                      onClick={() => setDirection(value)}
                      className={`rounded border px-3 py-2 text-sm ${direction === value ? (value > 0 ? "border-buy text-buy" : "border-sell text-sell") : "border-line text-muted"}`}
                    >
                      {value > 0 ? "Up" : "Down"}
                    </button>
                  ))}
                </div>
                <label className="block">
                  <span className="micro-label">Horizon</span>
                  <select
                    value={horizon}
                    onChange={(event) => setHorizon(Number(event.target.value) as typeof horizon)}
                    className="border-line bg-surface-2 mt-1 w-full rounded border px-3 py-2 text-sm"
                  >
                    {HORIZONS.map((value) => (
                      <option key={value} value={value}>
                        {value} seconds
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="micro-label">Stake (10 to 200 chips)</span>
                  <input
                    type="number"
                    min={10}
                    max={200}
                    value={stake}
                    onChange={(event) => setStake(Number(event.target.value))}
                    className="border-line bg-surface-2 mt-1 w-full rounded border px-3 py-2 font-mono text-sm"
                  />
                </label>
                <label className="block">
                  <span className="micro-label">Licence price (0 to 100, 0 = not for sale)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={licenseAsk}
                    onChange={(event) => setLicenseAsk(Number(event.target.value))}
                    className="border-line bg-surface-2 mt-1 w-full rounded border px-3 py-2 font-mono text-sm"
                  />
                </label>
                <Button
                  type="submit"
                  className="w-full"
                  loading={busy === "mint"}
                  disabled={
                    !mySeat ||
                    myOpen ||
                    stake < 10 ||
                    stake > 200 ||
                    licenseAsk < 0 ||
                    licenseAsk > 100 ||
                    (mySeat ? stake > mySeat.deskChips : false)
                  }
                >
                  {myOpen ? "You have an open Call" : `Commit ${direction > 0 ? "up" : "down"}`}
                </Button>
              </form>
            </Panel>
          </div>
        </div>
      )}
    </main>
  );
}
