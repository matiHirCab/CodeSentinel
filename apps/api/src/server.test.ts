import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { buildServer } from "./server";
import type { ApiEnv } from "./env";

const env: ApiEnv = {
  DATABASE_URL: "postgres://test",
  REDIS_URL: "redis://test",
  API_HOST: "127.0.0.1",
  API_PORT: 4000,
  FRONTEND_ORIGIN: "http://localhost:5173",
  GITHUB_WEBHOOK_SECRET: "secret",
  GITHUB_POSTING_MODE: "mock"
};

function signature(body: string) {
  return `sha256=${createHmac("sha256", env.GITHUB_WEBHOOK_SECRET).update(body).digest("hex")}`;
}

function payload(action = "opened") {
  return {
    action,
    installation: { id: 123 },
    repository: {
      id: 456,
      owner: { login: "acme" },
      name: "demo",
      full_name: "acme/demo",
      default_branch: "main",
      private: false
    },
    pull_request: {
      number: 9,
      title: "Change behavior",
      body: "body",
      user: { login: "dev" },
      base: { ref: "main" },
      head: { ref: "branch", sha: "abc123456" },
      state: "open",
      draft: false,
      html_url: "https://github.com/acme/demo/pull/9"
    }
  };
}

function fakePrisma(existingJob: unknown = null) {
  return {
    gitHubInstallation: {
      upsert: vi.fn().mockResolvedValue({ id: "install_1" })
    },
    repository: {
      upsert: vi.fn().mockResolvedValue({ id: "repo_1", owner: "acme", name: "demo" })
    },
    pullRequest: {
      upsert: vi.fn().mockResolvedValue({ id: "pr_1" })
    },
    analysisJob: {
      findUnique: vi.fn().mockResolvedValue(existingJob),
      create: vi.fn().mockResolvedValue({ id: "job_1" })
    }
  };
}

describe("GitHub webhook route", () => {
  it("rejects invalid signatures", async () => {
    const server = await buildServer({
      env,
      prisma: fakePrisma(),
      queue: { enqueue: vi.fn() },
      githubPoster: { postReview: vi.fn() }
    });

    const response = await server.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: { "content-type": "application/json", "x-github-event": "pull_request", "x-hub-signature-256": "sha256=bad" },
      payload: payload()
    });

    expect(response.statusCode).toBe(401);
  });

  it("enqueues one job for a supported pull request action", async () => {
    const prisma = fakePrisma();
    const queue = { enqueue: vi.fn().mockResolvedValue("bull_1") };
    const server = await buildServer({ env, prisma, queue, githubPoster: { postReview: vi.fn() } });
    const body = JSON.stringify(payload());

    const response = await server.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: { "content-type": "application/json", "x-github-event": "pull_request", "x-hub-signature-256": signature(body) },
      payload: body
    });

    expect(response.statusCode).toBe(202);
    expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ owner: "acme", pullNumber: 9, headSha: "abc123456" }));
    expect(prisma.analysisJob.create).toHaveBeenCalledOnce();
  });

  it("does not enqueue duplicate head SHAs", async () => {
    const prisma = fakePrisma({ id: "job_existing" });
    const queue = { enqueue: vi.fn() };
    const server = await buildServer({ env, prisma, queue, githubPoster: { postReview: vi.fn() } });
    const body = JSON.stringify(payload("synchronize"));

    const response = await server.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: { "content-type": "application/json", "x-github-event": "pull_request", "x-hub-signature-256": signature(body) },
      payload: body
    });

    expect(response.json()).toEqual({ enqueued: false, analysisJobId: "job_existing" });
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
