import type { ChangedFile, ContextFile } from "@codesentinel/shared";

const docCandidates = [
  "README.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "docs/architecture.md",
  "docs/product.md",
  "docs/review-engine.md",
  "docs/mvp-roadmap.md"
];

export type RepositoryContextClient = {
  fetchChangedFiles(owner: string, repo: string, pullNumber: number): Promise<ChangedFile[]>;
  fetchFileContent(owner: string, repo: string, path: string, ref: string): Promise<string | null>;
};

export function normalizeChangedFiles(files: ChangedFile[]): ChangedFile[] {
  return [...files]
    .map((file) => ({
      path: file.path,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
      previousPath: file.previousPath
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function gatherContext(input: {
  client: RepositoryContextClient;
  owner: string;
  repo: string;
  headSha: string;
  pullNumber: number;
  changedFiles: ChangedFile[];
  maxCharacters?: number;
}): Promise<ContextFile[]> {
  const maxCharacters = input.maxCharacters ?? 60_000;
  const candidates: ContextFile[] = [];

  for (const file of input.changedFiles.slice(0, 20)) {
    const content = await input.client.fetchFileContent(input.owner, input.repo, file.path, input.headSha);
    if (content) {
      candidates.push({ path: file.path, content, priority: 10, reason: "changed file" });
    }
  }

  for (const path of docCandidates) {
    const content = await input.client.fetchFileContent(input.owner, input.repo, path, input.headSha);
    if (content) {
      candidates.push({ path, content, priority: path === "AGENTS.md" ? 20 : 30, reason: "repository guidance" });
    }
  }

  return applyContextBudget(candidates, maxCharacters);
}

export function applyContextBudget(files: ContextFile[], maxCharacters: number): ContextFile[] {
  const selected: ContextFile[] = [];
  let used = 0;

  for (const file of [...files].sort((a, b) => a.priority - b.priority || a.path.localeCompare(b.path))) {
    const remaining = maxCharacters - used;
    if (remaining <= 0) {
      break;
    }
    const content = file.content.length > remaining ? file.content.slice(0, remaining) : file.content;
    selected.push({ ...file, content });
    used += content.length;
  }

  return selected;
}
