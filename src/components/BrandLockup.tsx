import Image from "next/image";

// The full lockup, mark and wordmark. The light file is the approved lockup with
// its white square removed and cropped to the artwork plus a little clear space,
// so it sits on any light or tinted ground without a box around it. The dark file
// is the same layout with no ground at all: the white FFN mark in place of the
// blue circle and the wordmark in white. CSS shows one or the other by theme
// (see .brand-lockup in globals.css). The default width is 180px, the brand
// book's minimum.
export function BrandLockup({ width = "calc(var(--sidebar-width) * 0.75)" }: { width?: string }) {
  return (
    <span className="brand-lockup" style={{ position: "relative", display: "block", width, aspectRatio: "663 / 212" }}>
      <Image
        className="brand-lockup__light"
        src="/logos/ffn-lockup-transparent.png"
        alt="Founders First Network"
        width={663}
        height={212}
        sizes="300px"
        priority
        style={{ width: "100%", height: "auto" }}
      />
      <Image
        className="brand-lockup__dark"
        src="/logos/ffn-lockup-white.png"
        alt="Founders First Network"
        width={663}
        height={212}
        sizes="300px"
        style={{ width: "100%", height: "auto" }}
      />
    </span>
  );
}
