import { analyzePrJobSchema, reviewProviderRequestSchema, validateProviderResponse, type AnalyzePrJob } from "@codesentinel/shared";
import { gatherContext, normalizeChangedFiles, type RepositoryContextClient } from "./context";
import { DatabaseFallbackContextClient, GitHubContextClient } from "./github";
import type { ReviewProvider } from "./provider";
import type { WorkerEnv } from "./env";

type Db = any;

export async function processAnalyzePr(input: {
  payload: AnalyzePrJob;
  prisma: Db;
  provider: ReviewProvider;
  env: WorkerEnv;
  contextClient?: RepositoryContextClient;
}) {
  const payload = analyzePrJobSchema.parse(input.payload);
  const job = await input.prisma.analysisJob.findUnique({
    where: {
      repositoryId_pullNumber_headSha: {
        repositoryId: payload.repositoryId,
        pullNumber: payload.pullNumber,
        headSha: payload.headSha
      }
    },
    include: { pullRequest: { include: { repository: true } } }
  });
  if (!job) {
    throw new Error("analysis job not found");
  }

  const existingRun = await input.prisma.reviewRun.findUnique({
    where: {
      pullRequestId_headSha_provider: {
        pullRequestId: job.pullRequestId,
        headSha: payload.headSha,
        provider: input.provider.name
      }
    }
  });
  if (existingRun && ["draft", "posted", "running"].includes(existingRun.status)) {
    return existingRun;
  }

  const run = existingRun
    ? await input.prisma.reviewRun.update({ where: { id: existingRun.id }, data: { status: "running", error: null } })
    : await input.prisma.reviewRun.create({
        data: {
          analysisJobId: job.id,
          pullRequestId: job.pullRequestId,
          headSha: payload.headSha,
          status: "running",
          provider: input.provider.name
        }
      });
  await input.prisma.analysisJob.update({ where: { id: job.id }, data: { status: "running", error: null } });

  try {
    const client =
      input.contextClient ??
      (input.env.GITHUB_APP_ID && input.env.GITHUB_PRIVATE_KEY
        ? new GitHubContextClient(input.env, payload.installationId)
        : new DatabaseFallbackContextClient(input.prisma, job.pullRequestId));
    const changedFiles = normalizeChangedFiles(await client.fetchChangedFiles(payload.owner, payload.repo, payload.pullNumber));

    await persistChangedFiles(input.prisma, job.pullRequestId, changedFiles);

    const contextFiles = await gatherContext({
      client,
      owner: payload.owner,
      repo: payload.repo,
      pullNumber: payload.pullNumber,
      headSha: payload.headSha,
      changedFiles
    });

    const providerRequest = reviewProviderRequestSchema.parse({
      repository: {
        owner: job.pullRequest.repository.owner,
        name: job.pullRequest.repository.name,
        fullName: job.pullRequest.repository.fullName,
        defaultBranch: job.pullRequest.repository.defaultBranch
      },
      pullRequest: {
        number: job.pullRequest.number,
        title: job.pullRequest.title,
        body: job.pullRequest.body ?? undefined,
        authorLogin: job.pullRequest.authorLogin,
        baseBranch: job.pullRequest.baseBranch,
        headBranch: job.pullRequest.headBranch,
        headSha: job.pullRequest.headSha
      },
      changedFiles,
      contextFiles
    });

    const review = validateProviderResponse(await input.provider.review(providerRequest));
    const findings = dedupeAndRankFindings(review.findings);

    await input.prisma.finding.deleteMany({ where: { reviewRunId: run.id } });
    await input.prisma.reviewRun.update({
      where: { id: run.id },
      data: {
        status: "draft",
        postingStatus: "not_posted",
        summary: review.summary,
        architectureNotes: review.architectureNotes,
        testingRecommendations: review.testingRecommendations,
        riskAssessment: review.riskAssessment,
        findings: {
          create: findings.map((finding) => ({
            filePath: finding.filePath,
            startLine: finding.startLine,
            endLine: finding.endLine,
            severity: finding.severity,
            category: finding.category,
            title: finding.title,
            risk: finding.risk,
            evidence: finding.evidence,
            suggestion: finding.suggestion,
            confidence: finding.confidence
          }))
        }
      }
    });
    await input.prisma.analysisJob.update({ where: { id: job.id }, data: { status: "draft" } });

    return input.prisma.reviewRun.findUnique({ where: { id: run.id }, include: { findings: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await input.prisma.reviewRun.update({ where: { id: run.id }, data: { status: "failed", error: message } });
    await input.prisma.analysisJob.update({ where: { id: job.id }, data: { status: "failed", error: message } });
    throw error;
  }
}

export function dedupeAndRankFindings(findings: ReturnType<typeof validateProviderResponse>["findings"]) {
  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  const seen = new Set<string>();
  return [...findings]
    .filter((finding) => {
      const key = `${finding.filePath ?? "general"}:${finding.startLine ?? "summary"}:${finding.category}:${finding.title.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.confidence - a.confidence)
    .slice(0, 20);
}

async function persistChangedFiles(prisma: Db, pullRequestId: string, changedFiles: any[]) {
  for (const file of changedFiles) {
    await prisma.changedFile.upsert({
      where: { pullRequestId_path: { pullRequestId, path: file.path } },
      update: file,
      create: { ...file, pullRequestId }
    });
  }
}
