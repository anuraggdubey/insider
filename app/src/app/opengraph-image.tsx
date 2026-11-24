import { ImageResponse } from "next/og";

export const alt = "INSIDER: front-running is the game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The link preview for the site: the brand, the line and the three ideas. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#07080a",
        color: "#e7e9ec",
        padding: "64px 72px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 52,
            height: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "4px solid #5ab4ff",
            color: "#5ab4ff",
            fontSize: 34,
            fontWeight: 800,
          }}
        >
          I
        </div>
        <div style={{ fontSize: 30, letterSpacing: 8, fontWeight: 700 }}>INSIDER</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
          Own the secret.
        </div>
        <div
          style={{
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            color: "#5ab4ff",
          }}
        >
          Front-running is the game.
        </div>
      </div>
      <div
        style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#8b919a" }}
      >
        <div>A dark mempool. Sealed Leaks. A real oracle.</div>
        <div>Solana · MagicBlock Private ER</div>
      </div>
    </div>,
    size,
  );
}
