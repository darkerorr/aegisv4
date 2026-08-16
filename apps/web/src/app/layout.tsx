import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppProviders } from "@/components/feedback/app-providers";

const geist = localFont({ src: [{ path: "../../public/fonts/geist.woff2", weight: "100 900" }], variable: "--font-sans", display: "swap" });
const geistMono = localFont({ src: [{ path: "../../public/fonts/geist-mono.woff2", weight: "100 900" }], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: { default: "Aegis — Every model you use. One deliberate workspace.", template: "%s — Aegis" },
  description: "Orchestrate every AI model — OpenAI, Anthropic, NVIDIA, Groq, Ollama and more — from one local-first, open-source workspace.",
  applicationName: "Aegis",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/aegis-logo.png", apple: "/brand/aegis-logo.png" },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Aegis",
    title: "Aegis — Every model you use. One deliberate workspace.",
    description: "Orchestrate every AI model — OpenAI, Anthropic, NVIDIA, Groq, Ollama and more — from one local-first, open-source workspace.",
    images: [{ url: "/brand/aegis-logo.png", width: 512, height: 512, alt: "Aegis" }],
  },
  twitter: {
    card: "summary",
    title: "Aegis — Every model you use. One deliberate workspace.",
    description: "Orchestrate every AI model from one local-first, open-source workspace.",
  },
};
export const viewport: Viewport = { themeColor: "#000000", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning><body className="grain"><a className="skip-link" href="#main">Skip to content</a><AppProviders>{children}</AppProviders></body></html>;
}
