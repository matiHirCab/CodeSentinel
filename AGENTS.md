# Agent Guidance

This repository contains CodeSentinel, a repository-aware AI code review platform. Agents working here should optimize for a usable MVP that demonstrates high-quality pull request review, not a broad collection of speculative features.

## Product Intent

CodeSentinel should behave like a senior engineer reviewing a pull request with repository context. It should understand the shape of the project, read relevant documentation, inspect nearby code, evaluate architectural impact, and produce concise, actionable feedback.

The review engine should focus on:

- correctness
- security
- architecture
- maintainability
- testing quality
- observability
- scalability
- deployment risk
- developer experience

Avoid building a generic linter, formatter, or nitpick generator.

## MVP Scope

Build toward this flow first:

1. GitHub App webhook receives a pull request event.
2. API stores PR metadata and enqueues analysis.
3. Worker fetches changed files, diffs, and repository context.
4. Review provider generates draft summary, findings, risk analysis, and testing recommendations.
5. Dashboard displays the draft review.
6. User approves selected output.
7. API posts approved comments and summary back to GitHub.

Explicitly defer:

- billing
- team management
- enterprise auth
- advanced RBAC
- full repository memory
- semantic code graphs
- IDE extension
- Slack/Jira integrations
- auto-fix workflows

## Technical Defaults

Use these defaults unless a later decision document changes them:

- TypeScript monorepo.
- React + Vite frontend.
- Fastify API.
- BullMQ worker.
- PostgreSQL + Prisma.
- Redis queue.
- GitHub App integration.
- Provider-based LLM interface with an OpenAI-compatible implementation and a mock provider.
- Draft-first review output with manual approval before posting to GitHub.

## Engineering Standards

- Keep package boundaries clear: frontend renders state, API handles HTTP/auth/orchestration, worker performs analysis, shared owns common types.
- Prefer typed schemas at boundaries between GitHub, API, worker, database, and LLM provider.
- Make webhook and queue processing idempotent by installation, repository, pull request number, and head SHA.
- Do not let frontend-only behavior become the source of truth for posting state or review state.
- Keep prompts, review aggregation, ranking, and context selection outside request handlers.
- Add deterministic tests around parsing, context selection, provider contracts, and posting behavior.

## Review Engine Standards

Findings should be useful enough that a developer would consider acting on them. Each finding should explain:

- what may be wrong
- why it matters
- where it appears
- how severe it is
- what a reasonable fix or next step would be

Do not produce findings for formatting, naming, or preference-only feedback unless it indicates a concrete risk.

## Documentation Expectations

When adding implementation, update the relevant context file if a major product, architecture, or review-engine assumption changes. Prefer small, accurate docs over broad aspirational docs.

