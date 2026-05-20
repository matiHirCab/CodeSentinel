import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const reviewRun = {
  id: "run_1",
  status: "draft",
  postingStatus: "not_posted",
  provider: "mock",
  summary: "Draft review summary",
  architectureNotes: "No architecture concern.",
  testingRecommendations: "Add tests.",
  riskAssessment: {
    security: { level: "low", reasoning: "No issue." },
    deployment: { level: "medium", reasoning: "Check rollout." },
    breakingChange: { level: "low", reasoning: "No API change." },
    maintainability: { level: "medium", reasoning: "Review consistency." },
    testingConfidence: { level: "medium", reasoning: "Needs tests." }
  },
  error: null,
  headSha: "abc1234",
  findings: [
    {
      id: "finding_1",
      filePath: "src/app.ts",
      startLine: 10,
      endLine: null,
      severity: "medium",
      category: "testing",
      title: "Verify changed behavior",
      risk: "Tests may be missing.",
      evidence: "src/app.ts changed",
      suggestion: "Add a focused test.",
      confidence: 0.8,
      approved: false,
      posted: false,
      githubCommentId: null
    }
  ],
  pullRequest: {
    number: 7,
    title: "Add retry handling",
    htmlUrl: "https://github.com/acme/demo/pull/7",
    repository: { fullName: "acme/demo" }
  }
};

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/repositories")) {
          return Response.json([{ id: "repo_1", fullName: "acme/demo", defaultBranch: "main", pullRequests: [{ id: "pr_1", number: 7, title: "Add retry handling", headSha: "abc1234", updatedAt: "" }] }]);
        }
        if (url.endsWith("/repositories/repo_1/pull-requests")) {
          return Response.json([{ id: "pr_1", number: 7, title: "Add retry handling", headSha: "abc1234", state: "open", reviewRuns: [{ id: "run_1", status: "draft", postingStatus: "not_posted", updatedAt: "" }] }]);
        }
        if (url.endsWith("/review-runs/run_1") && !init) {
          return Response.json(reviewRun);
        }
        if (url.endsWith("/review-runs/run_1/post")) {
          return Response.json({ status: "posted", githubReviewId: "mock-review" });
        }
        return new Response("not found", { status: 404 });
      })
    );
  });

  it("renders a draft review and posts selected output", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByText("acme/demo"));
    await user.click(await screen.findByText(/#7 Add retry handling/));

    expect(await screen.findByText("Draft review summary")).toBeInTheDocument();
    expect(screen.getByText("Verify changed behavior")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /post approved output/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/review-runs/run_1/post"), expect.objectContaining({ method: "POST" }));
    });
  });
});
