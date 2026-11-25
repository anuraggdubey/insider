"use client";

import { teeConnection } from "@insider/sdk";
import { RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInsider } from "@/app/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Capsule } from "@/components/ui/capsule";
import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { Stamp } from "@/components/ui/stamp";
import { Stepper } from "@/components/ui/stepper";
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
    <li className="border-line grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b px-4 py-4 last:border-0 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
      <Capsule
        size={48}
        rarity={open ? "rare" : "common"}
        state={open ? "sealed" : "opened"}
        motion="none"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{call.author}</span>
          {call.mine && <span className="text-sealed font-mono text-[10px] uppercase">You</span>}
          {open ? (
            <Badge tone="sealed">Sealed</Badge>
          ) : (
            <Stamp className={call.state === "right" ? "text-buy" : "text-sell"}>
              {call.state === "right" ? "Hit" : "Miss"} · {call.direction}
            </Stamp>
          )}
        </div>
        <div className="text-faint mt-1 font-mono text-[10px]">
          #{call.callId} · {call.horizon}s · stake {call.stake} · from $
          {call.mintedPrice.toFixed(2)}
          {open && ` · ${call.readers} reader${call.readers === 1 ? "" : "s"}`}
          {open && ` · ${remaining(call, now)}`}
          {open && ` · ${call.licenseAsk ? `${call.licenseAsk} chips / licence` : "not for sale"}`}
        </div>
      </div>
      {buyable && (
        <Button
          size="sm"
          variant="outline"
          className="col-start-2 sm:col-auto"
          loading={busy}
          onClick={() => onBuy(call)}
        >
          Buy licence · {call.licenseAsk}
        </Button>
      )}
    </li>
  );
}

export function DeskView() {
  const config = useInsider();
  const params = useSearchParams();
  const fixture = process.env.NODE_ENV !== "production" && params.get("fixture") === "1";
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
  const [prices, setPrices] = useState<Array<{ at: number; value: number }>>([]);
  const fixtureData = useRef<DeskData | null>(null);
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
        const result =
          process.env.NODE_ENV !== "production" && fixture
            ? (fixtureData.current ??= (await import("@/lib/desk-fixture")).fixtureDesk())
            : config.tableAuthority
              ? await fetchDesk(await teeConnection(config), config, me)
              : null;
        if (closed) return;
        setData(result);
        setStatus(result ? "online" : "offline");
        if (result?.price != null && result.priceAt != null) {
          if (process.env.NODE_ENV !== "production" && fixture) {
            const { fixtureOracle } = await import("@/lib/desk-fixture");
            if (!closed) setPrices(fixtureOracle.map((value, index) => ({ at: index, value })));
          } else {
            setPrices((current) =>
              current.some((point) => point.at === result.priceAt)
                ? current
                : [...current, { at: result.priceAt!, value: result.price! }].slice(-60),
            );
          }
        }
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
  }, [config, fixture, me, refresh]);

  const act = useCallback(
    async (name: string, action: () => Promise<void>) => {
      setBusy(name);
      try {
        if (fixture) {
          useToast.getState().add("Fixture only · no transaction submitted.");
          return;
        }
        await action();
        setRefresh((value) => value + 1);
      } catch (error) {
        useToast.getState().add(friendlyError(error));
      } finally {
        setBusy(null);
      }
    },
    [fixture],
  );

  const mySeat = data?.mySeat ?? null;
  const open = data?.calls.filter((call) => call.state === "open") ?? [];
  const judged = (data?.calls.filter((call) => call.state !== "open") ?? []).slice(0, 8);
  const myOpen = open.some((call) => call.mine);
  const low = Math.min(...prices.map((point) => point.value));
  const high = Math.max(...prices.map((point) => point.value));
  const points = prices
    .map(
      (point, index) =>
        `${(index / Math.max(1, prices.length - 1)) * 100},${48 - ((point.value - low) / Math.max(0.01, high - low)) * 40}`,
    )
    .join(" ");

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
          {fixture && (
            <Badge tone="opened" className="mt-3">
              Fixture · simulated, no transactions
            </Badge>
          )}
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
            <Screen label="SOL / USD · oracle">
              <div className="p-5">
                <div className="led-readout text-4xl">
                  {data.price == null ? "—" : `$${data.price.toFixed(2)}`}
                </div>
                <div className="text-muted mt-1 font-mono text-[10px]">
                  {data.priceAt
                    ? `Oracle update ${new Date(data.priceAt * 1000).toLocaleTimeString()}`
                    : "Oracle unavailable"}
                </div>
                {prices.length > 1 ? (
                  <svg
                    viewBox="0 0 100 52"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label="Observed oracle price history"
                    className="mt-3 h-24 w-full"
                  >
                    <polyline
                      points={points}
                      fill="none"
                      stroke="#5ccbf0"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                ) : (
                  <p className="text-muted mt-5 text-xs">
                    Waiting for another oracle update to draw the chart.
                  </p>
                )}
              </div>
            </Screen>
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
                <div
                  className="overflow-x-auto"
                  role="region"
                  aria-label="Analyst track record"
                  tabIndex={0}
                >
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
                    <Button
                      key={value}
                      aria-pressed={direction === value}
                      onClick={() => setDirection(value)}
                      variant={direction === value ? (value > 0 ? "buy" : "sell") : "outline"}
                    >
                      {value > 0 ? "Up" : "Down"}
                    </Button>
                  ))}
                </div>
                <div>
                  <span className="micro-label">Horizon</span>
                  <div
                    className="mt-2 grid grid-cols-3 gap-2"
                    role="group"
                    aria-label="Call horizon"
                  >
                    {HORIZONS.map((value) => (
                      <Button
                        key={value}
                        size="sm"
                        variant={horizon === value ? "ink" : "outline"}
                        aria-pressed={horizon === value}
                        onClick={() => setHorizon(value)}
                      >
                        {value}s
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="micro-label mb-2">Stake · 10 to 200 chips</div>
                  <Stepper
                    value={stake}
                    onChange={setStake}
                    min={10}
                    max={200}
                    step={10}
                    presets={[]}
                    label="Stake in chips"
                  />
                </div>
                <div>
                  <div className="micro-label mb-2">Licence · 0 to 100 (0 = not for sale)</div>
                  <Stepper
                    value={licenseAsk}
                    onChange={setLicenseAsk}
                    min={0}
                    max={100}
                    step={5}
                    presets={[]}
                    label="Licence price"
                  />
                </div>
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
                  {myOpen
                    ? "You have an open Call"
                    : `Seal call · ${direction > 0 ? "up" : "down"}`}
                </Button>
              </form>
            </Panel>
          </div>
        </div>
      )}
    </main>
  );
}
