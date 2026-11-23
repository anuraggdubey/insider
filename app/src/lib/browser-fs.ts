export function readFileSync(): never {
  throw new Error("Filesystem wallets are not available in the browser");
}
