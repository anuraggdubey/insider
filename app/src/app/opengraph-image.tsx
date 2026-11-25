import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

const logoSvg = readFileSync(join(process.cwd(), "public/brand/logo.svg"), "utf8")
  .replaceAll("#1a0f2e", "#161513")
  .replaceAll("#ffbf1f", "#ffc21a");
const logo = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`;

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
        background: "#eceae4",
        color: "#161513",
        fontFamily: "sans-serif",
      }}
    >
      <img src={logo} width={760} height={190} alt="" />
      <div style={{ fontSize: 44, fontWeight: 700, marginTop: 34, color: "#5e5a52" }}>
        A multiplayer game of hidden information
      </div>
    </div>,
    size,
  );
}
