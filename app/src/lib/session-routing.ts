import { Keypair, type PublicKey } from "@solana/web3.js";
import { updateFloor, useFloorStore, type FastSession, type WalletSigner } from "./floor-store";

export type SessionAction =
  | "ping"
  | "sendOrder"
  | "bid"
  | "openLeak"
  | "listLeak"
  | "buyListed"
  | "offerLicense"
  | "buyLicense"
  | "mintCall"
  | "buyCallLicense"
  | "deskTrade"
  | "claimSeat"
  | "cupJoin";

export type ActionActor = {
  signer: Keypair | WalletSigner;
  token?: PublicKey;
};

export function actionActor(
  action: SessionAction,
  player: Keypair | WalletSigner,
  session: FastSession | null,
  now = Date.now(),
): ActionActor {
  if (
    action === "claimSeat" ||
    action === "cupJoin" ||
    player instanceof Keypair ||
    !session ||
    !session.wallet.equals(player.publicKey)
  )
    return { signer: player };
  if (session.validUntil * 1000 <= now + 60_000)
    throw new Error("Fast mode expired, turn it on again.");
  return { signer: session.signer, token: session.token };
}

export function expireFastMode(session: FastSession) {
  const state = useFloorStore.getState();
  if (!state.session?.token.equals(session.token)) return;
  try {
    localStorage.removeItem(`insider.session.${session.wallet.toBase58()}`);
  } catch {}
  updateFloor({
    session: null,
    sessionStatus: "expired",
    sessionError: "Fast mode expired, turn it on again.",
  });
}

export function currentActionActor(action: SessionAction, player: Keypair | WalletSigner) {
  const state = useFloorStore.getState();
  if (
    action !== "claimSeat" &&
    action !== "cupJoin" &&
    state.identity === "wallet" &&
    ["restoring", "enabling", "disabling"].includes(state.sessionStatus)
  )
    throw new Error("Fast mode is changing. Please wait.");
  const session = state.identity === "wallet" ? state.session : null;
  try {
    return actionActor(action, player, session);
  } catch (error) {
    if (session) expireFastMode(session);
    throw error;
  }
}

export function sessionActionError(error: unknown, actor: ActionActor) {
  const logs =
    error && typeof error === "object" && "logs" in error && Array.isArray(error.logs)
      ? error.logs.join("\n")
      : "";
  const text = `${error instanceof Error ? error.message : String(error)}\n${logs}`;
  if (
    actor.token &&
    /InvalidToken|AccountNotInitialized|custom program error:\s*0xbc4\b/i.test(text)
  ) {
    const session = useFloorStore.getState().session;
    if (session?.token.equals(actor.token)) expireFastMode(session);
    return new Error("Fast mode expired, turn it on again.");
  }
  return error;
}
