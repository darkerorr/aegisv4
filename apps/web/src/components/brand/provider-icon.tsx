import type { SimpleIcon } from "simple-icons";
import {
  siGithub,
  siGmail,
  siGoogle,
  siGooglecalendar,
  siGoogledrive,
  siMeta,
  siMinimax,
  siPerplexity,
} from "simple-icons/icons";
import Image from "next/image";

const icons: Record<string, SimpleIcon | undefined> = {
  github: siGithub,
  gmail: siGmail,
  google: siGoogle,
  calendar: siGooglecalendar,
  drive: siGoogledrive,
  meta: siMeta,
  minimax: siMinimax,
  perplexity: siPerplexity,
};
const localBrands = new Set([
  "nvidia",
  "openrouter",
  "ollama",
  "lmstudio",
  "openai",
  "anthropic",
  "gemini",
  "mistral",
  "groq",
  "deepseek",
  "qwen",
  "hugging-face",
  "xai",
  "together",
  "fireworks",
  "sambanova",
  "hyperbolic",
  "zhipu",
  "moonshot",
  "novita",
]);
const colorBrands = new Set([
  "nvidia",
  "openrouter",
  "gemini",
  "mistral",
  "deepseek",
  "qwen",
  "hugging-face",
  "xai",
  "together",
  "fireworks",
  "sambanova",
  "hyperbolic",
  "zhipu",
  "moonshot",
  "novita",
]);
const labels: Record<string, string> = { llama: "L" };
const colors: Record<string, string> = {
  gmail: "#EA4335",
  drive: "#34A853",
  calendar: "#4285F4",
  google: "#fff",
  nvidia: "#76B900",
  github: "#fff",
  gemini: "#8AB4F8",
  xai: "#ECECEC",
  openai: "#10A37F",
  anthropic: "#D97757",
  groq: "#F55036",
  ollama: "#D4D4D4",
  lmstudio: "#6E56CF",
  meta: "#0668E1",
  mistral: "#FF7000",
  deepseek: "#4D6BFE",
  qwen: "#5D5CDE",
  "hugging-face": "#FF9D00",
  openrouter: "#8C63F6",
  together: "#FF5B4F",
  fireworks: "#FF6B35",
  perplexity: "#20C8C6",
  sambanova: "#7C3AED",
  hyperbolic: "#7B61FF",
  zhipu: "#3859FF",
  moonshot: "#3D6EF7",
  minimax: "#9747FF",
  novita: "#6A5AE0",
};
export function ProviderIcon({
  provider,
  size = 20,
  variant = "monochrome",
}: {
  provider: string;
  size?: 16 | 18 | 20 | 24 | 32 | 48;
  variant?: "color" | "monochrome" | "light" | "dark";
}) {
  const normalized = provider === "huggingface" ? "hugging-face" : provider;
  const icon = icons[normalized];
  const color =
    variant === "color"
      ? colors[normalized] || `#${icon?.hex || "fff"}`
      : variant === "dark"
        ? "#050505"
        : "currentColor";
  if (localBrands.has(normalized)) {
    const slug = normalized === "hugging-face" ? "huggingface" : normalized;
    if (variant === "color" && colorBrands.has(normalized))
      return (
        <Image
          src={`/brand/providers/${slug}-color.svg`}
          width={size}
          height={size}
          alt={normalized}
          className="provider-brand-icon"
        />
      );
    const url = `/brand/providers/${slug}.svg`;
    return (
      <span
        role="img"
        aria-label={normalized}
        className="provider-brand-mask"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          maskImage: `url(${url})`,
          WebkitMaskImage: `url(${url})`,
        }}
      />
    );
  }
  if (!icon)
    return (
      <span
        aria-label={provider}
        className="grid shrink-0 place-items-center rounded-full border border-current/20 font-mono font-bold"
        style={{ width: size, height: size, fontSize: size * 0.32 }}
      >
        {labels[normalized] || normalized.slice(0, 2).toUpperCase()}
      </span>
    );
  return (
    <svg
      role="img"
      aria-label={icon.title}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={color}
      className="shrink-0"
    >
      <path d={icon.path} />
    </svg>
  );
}
export function IntegrationIcon({
  integration,
  ...props
}: {
  integration: string;
  size?: 16 | 18 | 20 | 24 | 32 | 48;
  variant?: "color" | "monochrome" | "light" | "dark";
}) {
  return <ProviderIcon provider={integration} {...props} />;
}
