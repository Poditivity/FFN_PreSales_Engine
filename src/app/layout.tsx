import type { Metadata } from "next";
import { IBM_Plex_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/themeScript";
import { ThemeKeeper } from "@/lib/ThemeKeeper";
import { Providers } from "./providers";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Founders First Network",
  description: "FFN Presales Engine",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      // The inline script below sets data-theme before hydration, so the
      // attribute legitimately differs from what the server rendered.
      suppressHydrationWarning
      className={`${poppins.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeKeeper />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
