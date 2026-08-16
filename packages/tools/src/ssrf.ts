import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { WebSearchError, WEB_SEARCH_ERRORS } from "./providers/web-search-provider.js";

const LOCAL_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "0.0.0.0", "::", "::1", "instance-data", "instance-data.ec2.internal"]);
const CLOUD_METADATA = new Set(["169.254.169.254", "100.100.100.200", "metadata.google.internal", "metadata.aws.internal"]);

function ipv4Number(value: string): number | null {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function inCidr4(value: number, base: string, bits: number): boolean {
  const baseValue = ipv4Number(base);
  if (baseValue === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (baseValue & mask);
}

function blockedIpv4(address: string): boolean {
  const value = ipv4Number(address);
  if (value === null) return true;
  return [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
    ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
    ["224.0.0.0", 4], ["240.0.0.0", 4],
  ].some(([base, bits]) => inCidr4(value, String(base), Number(bits)));
}

function normalizedHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
}

function blockedIpv6(address: string): boolean {
  const value = normalizedHostname(address);
  if (value === "::" || value === "::1") return true;
  if (value.startsWith("::ffff:")) {
    const mapped = value.slice("::ffff:".length);
    return isIP(mapped) !== 4 || blockedIpv4(mapped);
  }
  const first = Number.parseInt(value.split(":", 1)[0] || "0", 16);
  if (!Number.isFinite(first)) return true;
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10
  if ((first & 0xff00) === 0xff00) return true; // multicast
  if (value.startsWith("2001:db8:")) return true; // documentation
  if (value.startsWith("100:")) return true; // discard-only 100::/64
  return false;
}

export function isBlockedIp(address: string): boolean {
  const normalized = normalizedHostname(address);
  const family = isIP(normalized);
  return family === 4 ? blockedIpv4(normalized) : family === 6 ? blockedIpv6(normalized) : true;
}

async function resolveHostname(hostname: string): Promise<string[]> {
  try { return (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address); }
  catch { return []; }
}

export async function validateUrl(input: string): Promise<{ ok: true; url: URL; addresses: string[] } | { ok: false; code: string; message: string }> {
  let url: URL;
  try { url = new URL(input); }
  catch { return { ok: false, code: "URL_BLOCKED", message: "Invalid URL." }; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, code: "URL_BLOCKED", message: "Only HTTP and HTTPS URLs are allowed." };
  if (url.username || url.password) return { ok: false, code: "URL_BLOCKED", message: "URLs containing credentials are blocked." };
  const hostname = normalizedHostname(url.hostname);
  if (LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return { ok: false, code: "URL_BLOCKED", message: "Local or internal hostnames are blocked." };
  }
  if (CLOUD_METADATA.has(hostname)) return { ok: false, code: "URL_BLOCKED", message: "Cloud metadata endpoints are blocked." };
  const addresses = isIP(hostname) ? [hostname] : await resolveHostname(hostname);
  if (addresses.length === 0) return { ok: false, code: "URL_RESOLUTION_FAILED", message: "The URL hostname could not be resolved safely." };
  if (addresses.some((address) => isBlockedIp(address) || CLOUD_METADATA.has(address))) {
    return { ok: false, code: "URL_BLOCKED", message: "The URL resolves to a blocked address." };
  }
  return { ok: true, url, addresses };
}

function limits() {
  return {
    maxBytes: Math.max(1, Number(process.env.WEB_SEARCH_MAX_PAGE_SIZE_KB) || 1024) * 1024,
    maxRedirects: 5,
  };
}

async function boundedText(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new WebSearchError(WEB_SEARCH_ERRORS.PAGE_TOO_LARGE.code, WEB_SEARCH_ERRORS.PAGE_TOO_LARGE.message);
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new WebSearchError(WEB_SEARCH_ERRORS.PAGE_TOO_LARGE.code, WEB_SEARCH_ERRORS.PAGE_TOO_LARGE.message);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(output);
}

function cleanText(text: string): string {
  return text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ").trim();
}

export async function readPageContent(urlToRead: string): Promise<{ content: string; title: string; contentType: string }> {
  const { maxBytes, maxRedirects } = limits();
  let currentUrl = urlToRead;
  try {
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      const validation = await validateUrl(currentUrl);
      if (!validation.ok) throw new WebSearchError(validation.code, validation.message);
      let response: Response;
      try {
        response = await fetch(validation.url, { headers: { "User-Agent": "Aegis/0.3 (+local web reader)" }, redirect: "manual" });
      } catch (cause) {
        throw cause;
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new WebSearchError(WEB_SEARCH_ERRORS.PAGE_UNREADABLE.code, "The page returned a redirect without a destination.");
        if (redirectCount === maxRedirects) throw new WebSearchError(WEB_SEARCH_ERRORS.PAGE_UNREADABLE.code, "The page returned too many redirects.");
        currentUrl = new URL(location, validation.url).href;
        continue;
      }
      if (!response.ok) throw new WebSearchError(WEB_SEARCH_ERRORS.PAGE_UNREADABLE.code, `The page returned HTTP ${response.status}.`);
      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      const readable = contentType.startsWith("text/") || /application\/(?:json|[^;]+\+json|xml|[^;]+\+xml|xhtml\+xml)/.test(contentType);
      if (!readable) throw new WebSearchError(WEB_SEARCH_ERRORS.PAGE_UNREADABLE.code, "The page is not a supported text document.");
      const text = await boundedText(response, maxBytes);
      const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(text);
      return { content: cleanText(text), title: cleanText(titleMatch?.[1] || validation.url.hostname), contentType };
    }
    throw new WebSearchError(WEB_SEARCH_ERRORS.PAGE_UNREADABLE.code, "The page returned too many redirects.");
  } finally {
    // no timeout to clear
  }
}