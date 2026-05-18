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

