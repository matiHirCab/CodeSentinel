import type { ReviewRunDetail } from "@codesentinel/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export type RepositoryListItem = {
  id: string;
  fullName: string;
  defaultBranch: string;
  pullRequests: Array<{ id: string; number: number; title: string; headSha: string; updatedAt: string }>;
};

export type PullRequestListItem = {
  id: string;
  number: number;
  title: string;
  headSha: string;
  state: string;
  reviewRuns: Array<{ id: string; status: string; postingStatus: string; updatedAt: string }>;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  repositories: () => getJson<RepositoryListItem[]>("/repositories"),
  pullRequests: (repositoryId: string) => getJson<PullRequestListItem[]>(`/repositories/${repositoryId}/pull-requests`),
  reviewRun: (reviewRunId: string) => getJson<ReviewRunDetail>(`/review-runs/${reviewRunId}`),
  postReview: async (reviewRunId: string, selectedFindingIds: string[], includeSummary: boolean) => {
    const response = await fetch(`${apiBaseUrl}/review-runs/${reviewRunId}/post`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selectedFindingIds, includeSummary })
    });
    if (!response.ok) {
      throw new Error(`Posting failed: ${response.status}`);
    }
    return response.json() as Promise<{ status: string; githubReviewId?: string }>;
  }
};
