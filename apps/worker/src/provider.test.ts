import { describe, expect, it } from "vitest";
import { MockReviewProvider } from "./provider";

describe("MockReviewProvider", () => {
  it("returns deterministic review output", async () => {
    const provider = new MockReviewProvider();
    const first = await provider.review({
      repository: { owner: "acme", name: "demo", fullName: "acme/demo", defaultBranch: "main" },
      pullRequest: {
        number: 1,
        title: "Change",
        authorLogin: "dev",
        baseBranch: "main",
        headBranch: "feature",
        headSha: "abc1234"
      },
      changedFiles: [{ path: "src/app.ts", status: "modified", additions: 1, deletions: 0, patch: "@@ patch" }],
      contextFiles: []
    });
    const second = await provider.review({
      repository: { owner: "acme", name: "demo", fullName: "acme/demo", defaultBranch: "main" },
      pullRequest: {
        number: 1,
        title: "Change",
        authorLogin: "dev",
        baseBranch: "main",
        headBranch: "feature",
        headSha: "abc1234"
      },
      changedFiles: [{ path: "src/app.ts", status: "modified", additions: 1, deletions: 0, patch: "@@ patch" }],
      contextFiles: []
    });

    expect(second).toEqual(first);
    expect(first.findings[0]?.category).toBe("testing");
  });
});
