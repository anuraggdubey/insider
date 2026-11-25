import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** The INSIDER capsule on a soft sky tile. */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1565ff",
      }}
    >
      <svg width={58} height={58} viewBox="0 0 120 124">
        <g transform="translate(0 2)">
          <path
            d="M14 64a46 46 0 0 0 92 0Z"
            fill="#fff"
            stroke="#0f1f5c"
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <path
            d="M14 60a46 46 0 0 1 92 0Z"
            fill="#ffd21f"
            stroke="#0f1f5c"
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <rect x={11} y={57} width={98} height={9} rx={4.5} fill="#0f1f5c" />
          <path
            d="M49 36C49 27 54 23 61 23C68 23 73 27 73 33C73 39.5 61 40 61 45"
            fill="none"
            stroke="#0f1f5c"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={61} cy={52.6} r={3.7} fill="#0f1f5c" />
        </g>
      </svg>
    </div>,
    size,
  );
}
