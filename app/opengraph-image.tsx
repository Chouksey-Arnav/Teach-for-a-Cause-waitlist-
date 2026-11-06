import { ImageResponse } from "next/og";

export const alt = "Teach for a Cause: tell us what you play and we’ll email you when a tutor joins";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#F8F6EE", color: "#2A2622", padding: 80 }}>
        <div style={{ fontSize: 34, color: "#A8482A" }}>Teach for a Cause</div>
        <div style={{ fontSize: 76, lineHeight: 1.1, fontFamily: "serif", display: "flex", flexWrap: "wrap" }}>
          Tell us what you play, and we’ll email you when a tutor joins.
        </div>
        <div style={{ fontSize: 30, color: "#675F56" }}>Free music lessons for North Carolina middle schoolers</div>
      </div>
    ),
    size
  );
}
