import { describe, expect, it } from "vitest";
import { analyzePrJobSchema, reviewProviderResponseSchema } from "./index";

describe("shared contracts", () => {
  it("validates analyze-pr job payloads", () => {
    expect(() =>
      analyzePrJobSchema.parse({
        installationId: 123,
        repositoryId: "repo_1",
        owner: "acme",
        repo: "widget",
        pullNumber: 42,
        headSha: "abc1234"
      })
    ).not.toThrow();
  });

  it("rejects invalid provider responses", () => {
    expect(() =>
      reviewProviderResponseSchema.parse({
        summary: "",
        findings: [{ severity: "style", category: "nitpick" }]
      })
    ).toThrow();
  });
});
