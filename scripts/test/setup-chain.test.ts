import { Connection, Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { config } from "../src/lib/config.js";
import { insiderProgram, tableAccounts } from "../src/lib/insider.js";
import { buildInstruction } from "../src/setup/chain.js";
import { emptyState, planSetup } from "../src/setup/plan.js";

describe("every setup step builds an instruction offline", () => {
  const authority = Keypair.generate();
  const connection = new Connection("http://127.0.0.1:1");
  const program = insiderProgram(connection, authority);
  const accounts = tableAccounts(authority.publicKey);
  const validator = Keypair.generate().publicKey;
  const steps = planSetup(emptyState()).flatMap((batch) => batch.steps);

  it("covers 25 creations and 25 delegations", () => {
    expect(steps.filter((s) => s.kind === "init")).toHaveLength(25);
    expect(steps.filter((s) => s.kind === "delegate")).toHaveLength(25);
  });

  it("targets the game program and names the authority as the signer", async () => {
    for (const step of steps) {
      const ix = await buildInstruction(program, authority.publicKey, accounts, step, validator);
      expect(ix.programId.equals(config.programId)).toBe(true);
      const signers = ix.keys.filter((k) => k.isSigner).map((k) => k.pubkey.toBase58());
      expect(signers).toEqual([authority.publicKey.toBase58()]);
    }
  });

  it("passes the validator last on delegation and nothing extra on creation", async () => {
    for (const step of steps) {
      const ix = await buildInstruction(program, authority.publicKey, accounts, step, validator);
      const last = ix.keys.at(-1)!.pubkey;
      expect(last.equals(validator)).toBe(step.kind === "delegate");
    }
  });
});
