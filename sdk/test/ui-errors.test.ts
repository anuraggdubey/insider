import { expect, it } from "vitest";
import { friendlyError } from "../../app/src/lib/errors";

it("maps Anchor errors to their human messages and never shows RPC tokens", () => {
  expect(friendlyError(new Error("custom program error: 0x177d"))).toBe("Position limit exceeded");
  expect(friendlyError(new Error("Error Code: AuctionOver"))).toBe("Auction is over");
  expect(friendlyError(new Error("request failed https://tee.example/?token=secret123"))).toBe(
    "request failed https://tee.example/?token=[redacted]",
  );
});
