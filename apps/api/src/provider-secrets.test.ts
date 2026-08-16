import { describe, expect, it } from "vitest";
import { decryptProviderSecret, encryptProviderSecret } from "./provider-secrets.js";

describe("provider credential encryption", () => {
  it("uses authenticated v2 envelopes and unique nonces", () => {
    const first = encryptProviderSecret("nvapi-test-secret");
    const second = encryptProviderSecret("nvapi-test-secret");
    expect(first).toMatch(/^v2:/);
    expect(first).not.toBe(second);
    expect(first).not.toContain("nvapi-test-secret");
    expect(decryptProviderSecret(first)).toBe("nvapi-test-secret");
  });

  it("rejects a modified authentication tag", () => {
    const encrypted = encryptProviderSecret("sk-or-test-secret");
    const parts = encrypted.split(":");
    parts[2] = `${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
    expect(decryptProviderSecret(parts.join(":"))).toBeUndefined();
  });
});
