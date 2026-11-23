import { describe, expect, it } from "vitest";
import { cancelWalletRequest, requestWallet, useWalletUi } from "../../app/src/lib/wallet-ui";

describe("wallet UI requests", () => {
  it("cancels only the request belonging to the departing control", () => {
    const first = requestWallet("play");
    const second = requestWallet("play");
    cancelWalletRequest(first);
    expect(useWalletUi.getState().request?.id).toBe(second);
    cancelWalletRequest(second);
    expect(useWalletUi.getState().request).toBeNull();
  });
});
