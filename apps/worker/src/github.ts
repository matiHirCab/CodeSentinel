import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import type { ChangedFile } from "@codesentinel/shared";
import type { WorkerEnv } from "./env";
import type { RepositoryContextClient } from "./context";

export class GitHubContextClient implements RepositoryContextClient {
  constructor(private readonly env: WorkerEnv, private readonly installationId: number) {}

  private async octokit() {
    if (!this.env.GITHUB_APP_ID || !this.env.GITHUB_PRIVATE_KEY) {
      throw new Error("GITHUB_APP_ID and GITHUB_PRIVATE_KEY are required to fetch GitHub context");
    }
    const auth = createAppAuth({
      appId: this.env.GITHUB_APP_ID,
      privateKey: this.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n"),
      installationId: this.installationId
    });
    const installationAuth = await auth({ type: "installation" });
    return new Octokit({ auth: installationAuth.token });
  }

  async fetchChangedFiles(owner: string, repo: string, pullNumber: number): Promise<ChangedFile[]> {
    const octokit = await this.octokit();
    const files = await octokit.paginate(octokit.pulls.listFiles, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100
    });
    return files.map((file) => ({
      path: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
      previousPath: file.previous_filename
    }));
  }

  async fetchFileContent(owner: string, repo: string, path: string, ref: string): Promise<string | null> {
    const octokit = await this.octokit();
    try {
      const response = await octokit.repos.getContent({ owner, repo, path, ref });
      if (Array.isArray(response.data) || response.data.type !== "file" || !("content" in response.data)) {
        return null;
      }
      return Buffer.from(response.data.content, "base64").toString("utf8");
    } catch (error: any) {
      if (error?.status === 404) {
        return null;
      }
      throw error;
    }
  }
}

export class DatabaseFallbackContextClient implements RepositoryContextClient {
  constructor(private readonly prisma: any, private readonly pullRequestId: string) {}

  async fetchChangedFiles(): Promise<ChangedFile[]> {
    return this.prisma.changedFile.findMany({ where: { pullRequestId: this.pullRequestId } });
  }

  async fetchFileContent(): Promise<string | null> {
    return null;
  }
}
