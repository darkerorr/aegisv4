import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getRuntimeConfig } from "@aegis/config";

export class ProviderSecretError extends Error {
  readonly code = "PROVIDER_ENCRYPTION_NOT_CONFIGURED";
  constructor() {
    super("Provider credential encryption is not configured on the Aegis API.");
    this.name = "ProviderSecretError";
  }
}

function deriveKey(material: string): Buffer {
  return createHash("sha256").update(material, "utf8").digest();
}

function providerKey(): Buffer {
  const configured = process.env.PROVIDERS_ENCRYPTION_KEY?.trim();
  if (configured) return deriveKey(configured);
  if (process.env.NODE_ENV === "production") throw new ProviderSecretError();
  // Local development and tests remain usable while production fails closed.
  return deriveKey(getRuntimeConfig().sessionSecret);
}

function legacyKey(): Buffer {
  return deriveKey(getRuntimeConfig().sessionSecret);
}

export function encryptProviderSecret(value: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", providerKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v2:${nonce.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptProviderSecret(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith("v1:") && !value.startsWith("v2:")) return value;
  try {
    const [version, nonce, tag, ciphertext] = value.split(":");
    const key = version === "v2" ? providerKey() : legacyKey();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return undefined;
  }
}

export function deleteProviderSecret(): null {
  return null;
}

export function providerEncryptionConfigured(): boolean {
  return Boolean(process.env.PROVIDERS_ENCRYPTION_KEY?.trim()) || process.env.NODE_ENV !== "production";
}
