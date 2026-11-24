import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

const logo = `data:image/svg+xml;base64,${readFileSync(join(process.cwd(), "public/brand/logo.svg")).toString("base64")}`;

export const alt = "INSIDER: own the secret";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The link preview: the capsule, the name and the line. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(180deg, #bfe3ff 0%, #e4f2ff 60%, #fff3fa 100%)",
        color: "#1a0f2e",
        fontFamily: "sans-serif",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} width={760} height={190} alt="" />
      <div style={{ fontSize: 44, fontWeight: 700, marginTop: 34, color: "#5b4e7a" }}>
        A multiplayer game of hidden information
      </div>
    </div>,
    size,
  );
}
