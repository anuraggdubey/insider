import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const ogSchema = z.object({
  title: text(80).default("The round, revealed"),
  line: text(160).default("The tape tells the rest of the story."),
  round: z
    .string()
    .regex(/^[1-9]\d{0,9}$/)
    .refine((value) => Number(value) <= 4_294_967_295)
    .optional(),
  pnl: z
    .string()
    .regex(/^-?\d{1,9}$/)
    .optional(),
  kind: text(32).optional(),
  seat: text(32).optional(),
});

export function parseOgParams(params: URLSearchParams) {
  return ogSchema.safeParse({
    title: params.get("title") ?? undefined,
    line: params.get("line") ?? undefined,
    round: params.get("round") ?? undefined,
    pnl: params.get("pnl") ?? undefined,
    kind: params.get("kind") ?? undefined,
    seat: params.get("seat") ?? undefined,
  });
}
