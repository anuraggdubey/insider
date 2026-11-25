import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** The INSIDER capsule on a cobalt tile. */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#2259f2",
      }}
    >
      <svg width={58} height={58} viewBox="0 0 120 124">
        <g transform="translate(0 2)">
          <path d="M12 60a48 48 0 0 0 96 0Z" fill="#ffffff" />
          <path d="M12 60a48 48 0 0 1 96 0Q60 69 12 60Z" fill="#ffc52e" />
          <path
            d="M51 29c0-8 5-11 11-11s10 4 10 10-9 7-9 14"
            fill="none"
            stroke="#2b2b33"
            strokeWidth={8}
            strokeLinecap="round"
          />
          <circle cx={63} cy={53} r={4.8} fill="#2b2b33" />
        </g>
      </svg>
    </div>,
    size,
  );
}
