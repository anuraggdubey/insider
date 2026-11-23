import idl from "../../../programs/idl/insider.json";

const messages = new Map(
  idl.errors.flatMap((entry) => [
    [String(entry.code), entry.msg] as const,
    [entry.name, entry.msg] as const,
  ]),
);

export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const logs =
    error && typeof error === "object" && "logs" in error && Array.isArray(error.logs)
      ? error.logs.join("\n")
      : "";
  const combined = `${message}\n${logs}`;
  const number = combined.match(/custom program error:\s*0x([0-9a-f]+)/i);
  const named = combined.match(/Error Code:\s*([A-Za-z0-9_]+)/i);
  const mapped =
    (number && messages.get(String(parseInt(number[1]!, 16)))) ||
    (named && messages.get(named[1]!));
  if (mapped) return mapped;
  const text = combined.match(/Error Message:\s*([^\n]+)/)?.[1] ?? message;
  return text.replace(/([?&]token=)[^&\s)"']+/gi, "$1[redacted]");
}
