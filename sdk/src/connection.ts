import { Connection } from "@solana/web3.js";
import type { InsiderConfig } from "./config";
import { teeAuthUrl, type MessageSigner } from "./tee";

export function baseConnection(config: InsiderConfig): Connection {
  return new Connection(config.baseRpcUrl, { commitment: "confirmed" });
}

export async function teeConnection(
  config: InsiderConfig,
  signer?: MessageSigner,
): Promise<Connection> {
  const endpoint = signer ? (await teeAuthUrl(config.teeRpcUrl, signer)).url : config.teeRpcUrl;
  const websocket = new URL(endpoint);
  websocket.protocol = websocket.protocol === "https:" ? "wss:" : "ws:";
  return new Connection(endpoint, { commitment: "confirmed", wsEndpoint: websocket.toString() });
}
