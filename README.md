# CodeSentinel

CodeSentinel is a repository-aware AI code review platform. It is designed to review GitHub pull requests with the judgment of a senior engineer: understanding repository context, architectural intent, testing expectations, operational risk, and maintainability tradeoffs.

The product is not a generic linter or style checker. It should prioritize high-signal review feedback that helps teams ship safer code, especially when pull requests include AI-generated changes.

## MVP Goal

The MVP should prove the core review workflow end to end:

1. A GitHub pull request event is received through a GitHub App webhook.
2. The backend fetches PR metadata, changed files, and diffs.
3. The worker gathers repository context from relevant files and documentation.
4. The review engine generates a draft PR summary, risk analysis, and inline findings.
5. A user reviews the draft output in the dashboard.
6. Approved comments and summaries are posted back to GitHub manually.

Reviews are draft-first. The system must not auto-post comments in the MVP.

## Product Principles

- Prefer signal over coverage.
- Review like a senior engineer, not a formatter.
- Explain the risk and reasoning behind each finding.
- Use repository context before making claims.
- Avoid nitpicks unless they point to a real maintainability, correctness, security, testing, deployment, or observability issue.
- Treat AI-generated code as a major use case and review it for hidden assumptions, brittle logic, and production risk.

## Default Architecture

CodeSentinel should start as a TypeScript monorepo:

- Frontend: React, Vite, Tailwind, and later Monaco where useful.
- API: Node.js with Fastify.
- Worker: BullMQ-based background processing.
- Database: PostgreSQL with Prisma.
- Queue: Redis.
- GitHub integration: GitHub App with webhook verification and installation tokens.
- AI integration: provider adapter with an OpenAI-compatible default and a deterministic mock provider for local development and tests.

## Main Components

- Dashboard for repositories, PR review runs, draft findings, and approval state.
- API for GitHub webhooks, repository data, review run access, and posting approved reviews.
- Worker for PR analysis, context assembly, review prompting, aggregation, ranking, and persistence.
- Shared package for schemas, DTOs, severity types, finding categories, risk models, and job payloads.

## Local Development Goals

The first working version should be runnable locally with:

- PostgreSQL and Redis from Docker Compose.
- API, worker, and frontend from monorepo scripts.
- Mock review provider enabled by default for deterministic local testing.
- GitHub App credentials supplied through environment variables when testing real webhooks.

See `docs/mvp-roadmap.md` for the intended implementation order.

## MVP Implementation

The repository now contains the initial MVP monorepo:

- `apps/api`: Fastify API for GitHub webhooks, dashboard data, review approval, and GitHub posting.
- `apps/worker`: BullMQ worker for PR diff/context gathering and draft review generation.
- `apps/frontend`: React + Vite dashboard for inspecting draft reviews and approving selected output.
- `packages/shared`: Zod schemas and TypeScript contracts shared across API, worker, and frontend.
- `prisma/schema.prisma`: PostgreSQL data model for installations, repositories, PRs, jobs, review runs, findings, and posting attempts.

Local dashboard access is trusted for the MVP. The mock review provider and mock GitHub posting mode are enabled by default so the end-to-end flow can be exercised without external credentials.

## Local Setup

Prerequisites:

- Node.js 22 or newer.
- Corepack enabled, or a local `pnpm` compatible with the pinned package manager.
- Docker for PostgreSQL and Redis.

Install dependencies and generate the Prisma client:

```bash
corepack pnpm install
corepack pnpm db:generate
```

Create a local environment file:

```bash
cp .env.example .env
```

Start local infrastructure and run migrations:

```bash
docker compose up -d
corepack pnpm db:migrate
```

Run the API, worker, and frontend together:

```bash
corepack pnpm dev
```

Default local URLs:

- API: `http://localhost:4000`
- Frontend: `http://localhost:5173`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Mock Webhook Flow

`fixtures/github-pull-request-opened.json` contains a sample pull request webhook payload. Sign the exact payload body with `GITHUB_WEBHOOK_SECRET` and send it to `POST /webhooks/github`.

The webhook stores PR metadata and enqueues an `analyze-pr` job. With the default mock provider, the worker can create a deterministic draft review from changed files already stored in the database or from GitHub context when GitHub App credentials are configured.

## Verification

Run checks with:

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

On Windows sandboxed environments, Vite/esbuild may need normal filesystem access while resolving frontend config. The project commands themselves are standard; this only affects restricted agent sandboxes.
