import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppProviders } from "@/components/feedback/app-providers";

const geist = localFont({ src: [{ path: "../../public/fonts/geist.woff2", weight: "100 900" }], variable: "--font-sans", display: "swap" });
const geistMono = localFont({ src: [{ path: "../../public/fonts/geist-mono.woff2", weight: "100 900" }], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Aegis — Every intelligence. One workspace.", template: "%s — Aegis" },
  description: "Use local models, leading cloud providers and connected tools from one private AI workspace.",
  applicationName: "Aegis",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/aegis-logo.png", apple: "/brand/aegis-logo.png" }
};
export const viewport: Viewport = { themeColor: "#000000", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning><body className="grain"><a className="skip-link" href="#main">Skip to content</a><AppProviders>{children}</AppProviders></body></html>;
}
