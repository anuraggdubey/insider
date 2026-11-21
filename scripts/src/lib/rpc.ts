import { PublicKey } from "@solana/web3.js";

export type DelegationStatus = {
  isDelegated: boolean;
  fqdn?: string;
  delegationRecord?: { authority: string; owner: string; delegationSlot: number; lamports: number };
};

export async function getDelegationStatus(
  routerUrl: string,
  account: PublicKey,
): Promise<DelegationStatus> {
  const response = await fetch(routerUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getDelegationStatus",
      params: [account.toBase58()],
    }),
  });
  const body = (await response.json()) as {
    result?: DelegationStatus;
    error?: { message: string };
  };
  if (body.error) throw new Error(`getDelegationStatus: ${body.error.message}`);
  return body.result as DelegationStatus;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitFor<T>(
  label: string,
  probe: () => Promise<T | undefined>,
  { timeoutMs = 60_000, intervalMs = 1_000 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value !== undefined) return value;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
