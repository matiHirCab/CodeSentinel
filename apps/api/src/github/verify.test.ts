import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGitHubSignature } from "./verify";

describe("verifyGitHubSignature", () => {
  it("accepts a valid sha256 signature", () => {
    const body = JSON.stringify({ action: "opened" });
    const secret = "dev-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

    expect(verifyGitHubSignature(body, signature, secret)).toBe(true);
  });

  it("rejects invalid signatures", () => {
    expect(verifyGitHubSignature("{}", "sha256=bad", "dev-secret")).toBe(false);
  });
});
