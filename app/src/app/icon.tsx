import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** The brand mark: a sealed-blue bordered square with an I, on the app's near-black. */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#07080a",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "5px solid #5ab4ff",
          color: "#5ab4ff",
          fontSize: 32,
          fontWeight: 800,
        }}
      >
        I
      </div>
    </div>,
    size,
  );
}
