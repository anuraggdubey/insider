import idl from "../../../programs/idl/insider.json";

export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const logs =
    error && typeof error === "object" && "logs" in error && Array.isArray(error.logs)
      ? error.logs.join("\n")
      : "";
  const combined = `${message}\n${logs}`;
  const number = combined.match(/custom program error:\s*0x([0-9a-f]+)/i);
  const named = combined.match(/Error Code:\s*([A-Za-z0-9_]+)/i);
  const item = idl.errors.find(
    (entry) =>
      (number && entry.code === parseInt(number[1]!, 16)) || (named && entry.name === named[1]),
  );
  if (item) return item.msg;
  const text = combined.match(/Error Message:\s*([^\n]+)/)?.[1] ?? message;
  return text.replace(/([?&]token=)[^&\s)"']+/gi, "$1[redacted]");
}
