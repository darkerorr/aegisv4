import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./auth.js";

describe("password security", () => {
  it("stores a one-way hash and verifies the original password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });
});
