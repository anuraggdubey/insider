import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "INSIDER",
    short_name: "INSIDER",
    description: "Orders wait in a TEE-sealed dark mempool. Buy a look. Jump the line.",
    start_url: "/",
    display: "standalone",
    background_color: "#bfe3ff",
    theme_color: "#bfe3ff",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
