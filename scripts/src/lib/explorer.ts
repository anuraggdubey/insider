export const baseTxUrl = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

export const erTxUrl = (signature: string, erUrl: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${encodeURIComponent(erUrl)}`;

export const addressUrl = (address: string) =>
  `https://explorer.solana.com/address/${address}?cluster=devnet`;
