import { CapsuleArt } from "@/components/ui/capsule-art";
import { SEAT_COLORS, YOU_COLOR } from "@/lib/seat-colors";
import { cn } from "@/lib/cn";

const rows = [
  [YOU_COLOR],
  ["#3a3a42", "#ffc52e"],
  ["#7448f5", "#2fc073", "#f5404a"],
  ["#25b8d1", "#ff6a35", "#93d62a", "#ff4f96"],
];

/** The ten seats stacked, as in the film's closing shot. */
export function CapsulePyramid({ size = 72, className }: { size?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("flex flex-col items-center", className)}>
      {rows.map((row, index) => (
        <div
          key={index}
          className="flex justify-center"
          style={{ marginTop: index ? -size * 0.3 : 0, gap: 0 }}
        >
          {row.map((color) => (
            <span key={color} style={{ marginInline: -size * 0.09 }}>
              <CapsuleArt size={size} color={color} mark={color === "#ffc52e"} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CapsuleRow({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("flex justify-center", className)}>
      {SEAT_COLORS.map((color) => (
        <span key={color} className="shrink-0">
          <CapsuleArt size={size} color={color} mark={color === "#ffc52e"} />
        </span>
      ))}
    </div>
  );
}
