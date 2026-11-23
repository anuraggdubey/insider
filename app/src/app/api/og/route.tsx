import { ImageResponse } from "next/og";
import { parseOgParams } from "@/lib/og";

export function GET(request: Request) {
  const parsed = parseOgParams(new URL(request.url).searchParams);
  if (!parsed.success) return new Response("Invalid image parameters", { status: 400 });
  const { title, line, round, pnl, kind, seat } = parsed.data;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#07080a",
        color: "#e7e9ec",
        padding: "65px 72px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 22,
            letterSpacing: 5,
            fontWeight: 700,
          }}
        >
          <span
            style={{
              display: "flex",
              color: "#5ab4ff",
              border: "2px solid #5ab4ff",
              padding: "6px 11px",
            }}
          >
            I
          </span>
          INSIDER
        </div>
        <div style={{ display: "flex", color: "#8a93a0", fontSize: 18, letterSpacing: 3 }}>
          {round ? `ROUND ${round} / X-RAY` : "AFTER THE BELL / X-RAY"}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 70, flex: 1 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            color: "#ffb547",
            fontSize: 16,
            letterSpacing: 3,
          }}
        >
          <span style={{ width: 8, height: 8, background: "#ffb547", borderRadius: "50%" }} />
          PUBLIC INTELLIGENCE
        </div>
        <div
          style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.12, marginTop: 18, maxWidth: 960 }}
        >
          {title}
        </div>
        <div
          style={{ fontSize: 26, lineHeight: 1.4, color: "#a5aeba", marginTop: 18, maxWidth: 930 }}
        >
          {line}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 32, alignItems: "center" }}>
          {kind && (
            <div
              style={{
                border: "1px solid #315b78",
                color: "#5ab4ff",
                padding: "8px 14px",
                fontSize: 18,
              }}
            >
              {kind}
            </div>
          )}
          {seat && <div style={{ color: "#a5aeba", fontSize: 20 }}>{seat}</div>}
          {pnl !== undefined && (
            <div
              style={{
                color: Number(pnl) >= 0 ? "#3ddc97" : "#ff5c6c",
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              {`${Number(pnl) > 0 ? "+" : ""}${pnl} CHIPS`}
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          borderTop: "1px solid #2a313b",
          paddingTop: 24,
          color: "#8a93a0",
          fontSize: 15,
          letterSpacing: 2,
        }}
      >
        <span>THE TAPE DOESN&apos;T FORGET</span>
        <span>INSIDER / PRIVATE UNTIL IT ISN&apos;T</span>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
