import type { NextConfig } from "next";

// Headers that are safe on every page. A Content-Security-Policy is deliberately not set here:
// the app loads fonts, images and files from several hosts, and a policy needs testing against
// each before it is turned on.
const everywhere = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: everywhere },
      // The admin screens are never meant to sit inside another site's frame. Public forms and
      // applicant hubs are left alone in case they are embedded.
      { source: "/admin/:path*", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
};

export default nextConfig;
