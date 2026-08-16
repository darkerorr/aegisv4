import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000"),
  title: { default: "Aegis | Your AI workspace everywhere", template: "%s | Aegis" },
  description: "Chat on the web. Build from the terminal. Run local or remote models through one secure workspace.",
  icons: { icon: "/favicon.ico", apple: "/icon-192.png" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Aegis | Your AI workspace everywhere",
    description: "A secure AI workspace across Web, App and CLI.",
    images: [{ url: "/brand/aegis-logo.png", width: 1024, height: 1024, alt: "Aegis logo" }],
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#05070d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
