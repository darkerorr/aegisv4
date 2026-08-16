const BRAND_PATTERNS: Array<[RegExp, string]> = [
  [/chatgpt/, "openai"],
  [/openai/, "openai"],
  [/^gpt/, "openai"],
  [/gpt-oss/, "openai"],
  [/o[1-4](?:-|\.|\b|$)/, "openai"],
  [/claude/, "anthropic"],
  [/anthropic/, "anthropic"],
  [/gemini/, "gemini"],
  [/^palm/, "gemini"],
  [/google/, "gemini"],
  [/mixtral|codestral|ministral|mistralai|mistral/, "mistral"],
  [/qwen/, "qwen"],
  [/deepseek/, "deepseek"],
  [/groq/, "groq"],
  [/grok/, "xai"],
  [/llama/, "meta"],
  [/together/, "together"],
  [/fireworks/, "fireworks"],
  [/perplexity|sonar/, "perplexity"],
  [/sambanova|samba-nova/, "sambanova"],
  [/hyperbolic/, "hyperbolic"],
  [/glm|zhipu|bigmodel/, "zhipu"],
  [/kimi|moonshot/, "moonshot"],
  [/minimax/, "minimax"],
  [/novita/, "novita"],
  [/hugging/, "hugging-face"],
  [/nvidia/, "nvidia"],
  [/openrouter/, "openrouter"],
  [/ollama/, "ollama"],
  [/lmstudio|lm-studio|lm studio/, "lmstudio"],
];

const BRAND_COLORS: Record<string, string> = {
  openai: "#10A37F",
  anthropic: "#D97757",
  gemini: "#8AB4F8",
  mistral: "#FF7000",
  qwen: "#5D5CDE",
  deepseek: "#4D6BFE",
  groq: "#F55036",
  xai: "#ECECEC",
  meta: "#0668E1",
  "hugging-face": "#FF9D00",
  nvidia: "#76B900",
  openrouter: "#8C63F6",
  ollama: "#D4D4D4",
  lmstudio: "#6E56CF",
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

const AEGIS_RED = "#e5342b";

export function modelBrandColor(
  model: { name?: string; id?: string; family?: string } | null | undefined,
  fallback = AEGIS_RED,
): string {
  if (!model) return fallback;
  return BRAND_COLORS[modelBrandSlug(model, "")] ?? fallback;
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return `rgba(229, 52, 43, ${alpha})`;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function hexToRgbTriplet(hex: string): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return "229, 52, 43";
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export function darkenHex(hex: string, ratio: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return "#b8231b";
  const n = parseInt(full, 16);
  const r = Math.round(((n >> 16) & 255) * ratio);
  const g = Math.round(((n >> 8) & 255) * ratio);
  const b = Math.round((n & 255) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

export function providerSlug(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("nvidia")) return "nvidia";
  if (v.includes("openrouter")) return "openrouter";
  if (v.includes("x-ai") || v.includes("xai") || v.includes("grok")) return "xai";
  if (v.includes("ollama")) return "ollama";
  if (v.includes("studio")) return "lmstudio";
  if (v.includes("meta") || v.includes("llama")) return "meta";
  if (v.includes("together")) return "together";
  if (v.includes("fireworks")) return "fireworks";
  if (v.includes("perplexity")) return "perplexity";
  if (v.includes("sambanova") || v.includes("samba-nova")) return "sambanova";
  if (v.includes("hyperbolic")) return "hyperbolic";
  if (v.includes("zhipu") || v.includes("glm")) return "zhipu";
  if (v.includes("moonshot") || v.includes("kimi")) return "moonshot";
  if (v.includes("minimax")) return "minimax";
  if (v.includes("novita")) return "novita";
  if (v.includes("huggingface") || v.includes("hugging-face") || v.includes("hf")) return "hugging-face";
  return v.replace(/[^a-z]/g, "");
}

export function modelBrandSlug(
  model: { name?: string; id?: string; family?: string },
  fallback = "",
): string {
  const value = [model.family, model.name, model.id].filter(Boolean).join(" ").toLowerCase();
  for (const [pattern, brand] of BRAND_PATTERNS) {
    if (pattern.test(value)) return brand;
  }
  return fallback;
}
