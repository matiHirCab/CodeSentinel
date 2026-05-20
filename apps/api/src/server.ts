import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { analyzePrJobSchema, postReviewRequestSchema, reviewRunDetailSchema } from "@codesentinel/shared";
import type { ApiEnv } from "./env";
import type { AnalyzeQueue } from "./queue";
import type { GitHubPoster } from "./github/client";
import { verifyGitHubSignature } from "./github/verify";

type Db = any;

const supportedPullRequestActions = new Set(["opened", "synchronize", "reopened", "ready_for_review"]);

type Deps = {
  env: ApiEnv;
  prisma: Db;
  queue: AnalyzeQueue;
  githubPoster: GitHubPoster;
};

export async function buildServer(deps: Deps): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: deps.env.FRONTEND_ORIGIN });

  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_request, body, done) => {
    const rawBody = body.toString("utf8");
    try {
      done(null, { rawBody, payload: JSON.parse(rawBody) });
    } catch (error) {
      done(error as Error);
    }
  });

  app.get("/health", async () => ({ ok: true }));

  app.post("/webhooks/github", async (request, reply) => {
    const body = request.body as { rawBody: string; payload: any };
    const signature = request.headers["x-hub-signature-256"] as string | undefined;
    if (!verifyGitHubSignature(body.rawBody, signature, deps.env.GITHUB_WEBHOOK_SECRET)) {
      return reply.code(401).send({ error: "invalid_signature" });
    }

    const event = request.headers["x-github-event"];
    if (event !== "pull_request") {
      return { ignored: true, reason: "unsupported_event" };
    }

    const payload = body.payload;
    if (!supportedPullRequestActions.has(payload.action)) {
      return { ignored: true, reason: "unsupported_action" };
    }

    const installationId = Number(payload.installation?.id);
    const repo = payload.repository;
    const pr = payload.pull_request;
    if (!installationId || !repo || !pr) {
      return reply.code(400).send({ error: "missing_pull_request_payload" });
    }

    const installation = await deps.prisma.gitHubInstallation.upsert({
      where: { installationId: BigInt(installationId) },
      update: { accountLogin: repo.owner.login },
      create: { installationId: BigInt(installationId), accountLogin: repo.owner.login }
    });

    const repository = await deps.prisma.repository.upsert({
      where: { githubId: BigInt(repo.id) },
      update: {
        installationId: installation.id,
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
        defaultBranch: repo.default_branch,
        private: Boolean(repo.private)
      },
      create: {
        githubId: BigInt(repo.id),
        installationId: installation.id,
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
        defaultBranch: repo.default_branch,
        private: Boolean(repo.private)
      }
    });

    const pullRequest = await deps.prisma.pullRequest.upsert({
      where: { repositoryId_number: { repositoryId: repository.id, number: pr.number } },
      update: {
        title: pr.title,
        body: pr.body,
        authorLogin: pr.user.login,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
        headSha: pr.head.sha,
        state: pr.state,
        draft: Boolean(pr.draft),
        htmlUrl: pr.html_url
      },
      create: {
        repositoryId: repository.id,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        authorLogin: pr.user.login,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
        headSha: pr.head.sha,
        state: pr.state,
        draft: Boolean(pr.draft),
        htmlUrl: pr.html_url
      }
    });

    const existingJob = await deps.prisma.analysisJob.findUnique({
      where: { repositoryId_pullNumber_headSha: { repositoryId: repository.id, pullNumber: pr.number, headSha: pr.head.sha } }
    });

    if (existingJob) {
      return { enqueued: false, analysisJobId: existingJob.id };
    }

    const jobPayload = analyzePrJobSchema.parse({
      installationId,
      repositoryId: repository.id,
      owner: repository.owner,
      repo: repository.name,
      pullNumber: pr.number,
      headSha: pr.head.sha
    });
    const bullJobId = await deps.queue.enqueue(jobPayload);
    const analysisJob = await deps.prisma.analysisJob.create({
      data: {
        repositoryId: repository.id,
        pullRequestId: pullRequest.id,
        installationId: BigInt(installationId),
        pullNumber: pr.number,
        headSha: pr.head.sha,
        bullJobId
      }
    });

    return reply.code(202).send({ enqueued: true, analysisJobId: analysisJob.id });
  });

  app.get("/repositories", async () => {
    const repositories = await deps.prisma.repository.findMany({
      orderBy: { updatedAt: "desc" },
      include: { pullRequests: { orderBy: { updatedAt: "desc" }, take: 5 } }
    });
    return jsonSafe(repositories);
  });

  app.get("/repositories/:id/pull-requests", async (request) => {
    const { id } = request.params as { id: string };
    const pullRequests = await deps.prisma.pullRequest.findMany({
      where: { repositoryId: id },
      orderBy: { updatedAt: "desc" },
      include: { reviewRuns: { orderBy: { updatedAt: "desc" }, take: 1 } }
    });
    return jsonSafe(pullRequests);
  });

  app.get("/review-runs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await deps.prisma.reviewRun.findUnique({
      where: { id },
      include: {
        findings: { orderBy: [{ severity: "asc" }, { createdAt: "asc" }] },
        pullRequest: { include: { repository: true } }
      }
    });
    if (!run) {
      return reply.code(404).send({ error: "review_run_not_found" });
    }
    return serializeReviewRun(run);
  });

  app.post("/review-runs/:id/post", async (request, reply) => {
    const { id } = request.params as { id: string };
    const approval = postReviewRequestSchema.parse((request.body as { payload?: unknown }).payload ?? request.body);
    if (!approval.includeSummary && approval.selectedFindingIds.length === 0) {
      return reply.code(400).send({ error: "nothing_selected" });
    }

    const run = await deps.prisma.reviewRun.findUnique({
      where: { id },
      include: {
        findings: true,
        analysisJob: true,
        pullRequest: { include: { repository: true } }
      }
    });
    if (!run) {
      return reply.code(404).send({ error: "review_run_not_found" });
    }
    if (run.status !== "draft" || run.postingStatus !== "not_posted") {
      return reply.code(409).send({ error: "review_run_not_postable" });
    }

    const selected = run.findings.filter((finding: any) => approval.selectedFindingIds.includes(finding.id));
    if (selected.length !== approval.selectedFindingIds.length) {
      return reply.code(400).send({ error: "invalid_finding_selection" });
    }

    const attempt = await deps.prisma.postingAttempt.create({
      data: {
        reviewRunId: run.id,
        status: "posting",
        selectedFindingIds: approval.selectedFindingIds,
        includeSummary: approval.includeSummary
      }
    });
    await deps.prisma.reviewRun.update({ where: { id: run.id }, data: { postingStatus: "posting" } });

    try {
      const detail = serializeReviewRun({ ...run, findings: selected });
      const result = await deps.githubPoster.postReview({
        installationId: Number(run.analysisJob.installationId),
        owner: run.pullRequest.repository.owner,
        repo: run.pullRequest.repository.name,
        pullNumber: run.pullRequest.number,
        headSha: run.headSha,
        includeSummary: approval.includeSummary,
        selectedFindings: detail.findings,
        summary: run.summary
      });
      const failed = result.findings.filter((finding) => finding.error);
      const status = failed.length === 0 ? "posted" : failed.length === result.findings.length && !result.summaryPosted ? "failed" : "partial";

      for (const postedFinding of result.findings) {
        if (!postedFinding.error) {
          await deps.prisma.finding.update({
            where: { id: postedFinding.findingId },
            data: { approved: true, posted: true, githubCommentId: postedFinding.githubCommentId }
          });
        }
      }

      await deps.prisma.postingAttempt.update({
        where: { id: attempt.id },
        data: {
          status,
          githubReviewId: result.githubReviewId,
          error: failed.map((finding) => `${finding.findingId}: ${finding.error}`).join("\n") || null
        }
      });
      await deps.prisma.reviewRun.update({
        where: { id: run.id },
        data: { postingStatus: status, status: status === "posted" ? "posted" : "draft" }
      });

      return { status, githubReviewId: result.githubReviewId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await deps.prisma.postingAttempt.update({ where: { id: attempt.id }, data: { status: "failed", error: message } });
      await deps.prisma.reviewRun.update({ where: { id: run.id }, data: { postingStatus: "failed" } });
      return reply.code(502).send({ error: "github_post_failed", message });
    }
  });

  return app;
}

function serializeReviewRun(run: any) {
  return reviewRunDetailSchema.parse({
    id: run.id,
    status: run.status,
    postingStatus: run.postingStatus,
    provider: run.provider,
    summary: run.summary,
    architectureNotes: run.architectureNotes,
    testingRecommendations: run.testingRecommendations,
    riskAssessment: run.riskAssessment,
    error: run.error,
    headSha: run.headSha,
    findings: run.findings.map((finding: any) => ({
      id: finding.id,
      filePath: finding.filePath ?? undefined,
      startLine: finding.startLine ?? undefined,
      endLine: finding.endLine ?? undefined,
      severity: finding.severity,
      category: finding.category,
      title: finding.title,
      risk: finding.risk,
      evidence: finding.evidence,
      suggestion: finding.suggestion ?? undefined,
      confidence: finding.confidence,
      approved: finding.approved,
      posted: finding.posted,
      githubCommentId: finding.githubCommentId
    })),
    pullRequest: {
      number: run.pullRequest.number,
      title: run.pullRequest.title,
      htmlUrl: run.pullRequest.htmlUrl,
      repository: { fullName: run.pullRequest.repository.fullName }
    }
  });
}

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) => (typeof nestedValue === "bigint" ? Number(nestedValue) : nestedValue))
  ) as T;
}
