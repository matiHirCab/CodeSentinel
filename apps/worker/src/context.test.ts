import { describe, expect, it } from "vitest";
import { applyContextBudget, normalizeChangedFiles } from "./context";

describe("context selection", () => {
  it("normalizes changed files deterministically", () => {
    expect(
      normalizeChangedFiles([
        { path: "b.ts", status: "modified", additions: 1, deletions: 0 },
        { path: "a.ts", status: "added", additions: 2, deletions: 0 }
      ]).map((file) => file.path)
    ).toEqual(["a.ts", "b.ts"]);
  });

  it("applies priority order and trims to budget", () => {
    const selected = applyContextBudget(
      [
        { path: "README.md", content: "readme", priority: 30, reason: "docs" },
        { path: "src/app.ts", content: "1234567890", priority: 10, reason: "changed" }
      ],
      12
    );

    expect(selected).toEqual([
      { path: "src/app.ts", content: "1234567890", priority: 10, reason: "changed" },
      { path: "README.md", content: "re", priority: 30, reason: "docs" }
    ]);
  });
});
