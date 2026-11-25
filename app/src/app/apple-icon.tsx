import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The INSIDER capsule on a soft sky tile. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#eceae4",
      }}
    >
      <svg width={150} height={150} viewBox="0 0 120 124">
        <g transform="translate(0 2)">
          <path
            d="M14 64a46 46 0 0 0 92 0Z"
            fill="#fff"
            stroke="#161513"
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <path
            d="M14 60a46 46 0 0 1 92 0Z"
            fill="#ffc21a"
            stroke="#161513"
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <rect x={11} y={57} width={98} height={9} rx={4.5} fill="#161513" />
          <path
            d="M49 36C49 27 54 23 61 23C68 23 73 27 73 33C73 39.5 61 40 61 45"
            fill="none"
            stroke="#161513"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={61} cy={52.6} r={3.7} fill="#161513" />
        </g>
      </svg>
    </div>,
    size,
  );
}
