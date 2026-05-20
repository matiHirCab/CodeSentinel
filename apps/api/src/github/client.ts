import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import type { ReviewRunDetail } from "@codesentinel/shared";
import type { ApiEnv } from "../env";

export type PostedFindingResult = {
  findingId: string;
  githubCommentId?: string;
  error?: string;
};

export type PostReviewInput = {
  installationId: number;
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
  includeSummary: boolean;
  selectedFindings: ReviewRunDetail["findings"];
  summary: string | null;
};

export interface GitHubPoster {
  postReview(input: PostReviewInput): Promise<{
    githubReviewId?: string;
    findings: PostedFindingResult[];
    summaryPosted: boolean;
  }>;
}

export class MockGitHubPoster implements GitHubPoster {
  async postReview(input: PostReviewInput) {
    return {
      githubReviewId: `mock-review-${input.pullNumber}-${input.headSha.slice(0, 7)}`,
      findings: input.selectedFindings.map((finding) => ({
        findingId: finding.id,
        githubCommentId: `mock-comment-${finding.id}`
      })),
      summaryPosted: input.includeSummary
    };
  }
}

export class GitHubAppPoster implements GitHubPoster {
  constructor(private readonly env: ApiEnv) {}

  async postReview(input: PostReviewInput) {
    if (!this.env.GITHUB_APP_ID || !this.env.GITHUB_PRIVATE_KEY) {
      throw new Error("GITHUB_APP_ID and GITHUB_PRIVATE_KEY are required for GitHub posting");
    }

    const auth = createAppAuth({
      appId: this.env.GITHUB_APP_ID,
      privateKey: this.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n"),
      installationId: input.installationId
    });
    const installationAuth = await auth({ type: "installation" });
    const octokit = new Octokit({ auth: installationAuth.token });

    const bodyLines = [
      input.includeSummary && input.summary ? input.summary : undefined,
      input.selectedFindings.length > 0 ? "Approved CodeSentinel findings are included as review comments." : undefined
    ].filter(Boolean);

    const review = await octokit.pulls.createReview({
      owner: input.owner,
      repo: input.repo,
      pull_number: input.pullNumber,
      commit_id: input.headSha,
      event: "COMMENT",
      body: bodyLines.join("\n\n") || "CodeSentinel reviewed this pull request."
    });

    const findings: PostedFindingResult[] = [];
    for (const finding of input.selectedFindings) {
      if (!finding.filePath || !finding.startLine) {
        findings.push({ findingId: finding.id });
        continue;
      }
      try {
        const comment = await octokit.pulls.createReviewComment({
          owner: input.owner,
          repo: input.repo,
          pull_number: input.pullNumber,
          commit_id: input.headSha,
          path: finding.filePath,
          line: finding.startLine,
          body: `**${finding.title}**\n\n${finding.risk}\n\nEvidence: ${finding.evidence}${finding.suggestion ? `\n\nSuggested next step: ${finding.suggestion}` : ""}`
        });
        findings.push({ findingId: finding.id, githubCommentId: String(comment.data.id) });
      } catch (error) {
        findings.push({ findingId: finding.id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return {
      githubReviewId: String(review.data.id),
      findings,
      summaryPosted: input.includeSummary
    };
  }
}

export function createGitHubPoster(env: ApiEnv): GitHubPoster {
  return env.GITHUB_POSTING_MODE === "github" ? new GitHubAppPoster(env) : new MockGitHubPoster();
}
