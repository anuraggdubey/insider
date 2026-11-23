import { Keypair } from "@solana/web3.js";
import { expect, it, vi } from "vitest";
import { createConfig } from "../src/config";

const auth = vi.hoisted(() => ({
  loaded: false,
  getAuthToken: vi.fn().mockResolvedValue({ token: "token", expiresAt: Date.now() + 60_000 }),
}));
vi.mock("@magicblock-labs/ephemeral-rollups-sdk", () => {
  auth.loaded = true;
  return { getAuthToken: auth.getAuthToken };
});

it("loads authentication only for a signed TEE connection", async () => {
  const { teeConnection } = await import("../src/connection");
  const config = createConfig({ teeRpcUrl: "https://lazy-tee.example" });
  const anonymous = await teeConnection(config);
  expect(anonymous.rpcEndpoint).toBe(config.teeRpcUrl);
  expect(auth.loaded).toBe(false);
  const signed = await teeConnection(config, Keypair.generate());
  expect(signed.rpcEndpoint).toBe("https://lazy-tee.example/?token=token");
  expect(auth.loaded).toBe(true);
  expect(auth.getAuthToken).toHaveBeenCalledOnce();
});
