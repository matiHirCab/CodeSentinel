# Architecture

## Overview

CodeSentinel should start as a TypeScript monorepo. The architecture should support a local MVP while leaving room for a future split between API, worker, and AI services if needed.

Default components:

- Frontend: React + Vite.
- API: Fastify.
- Worker: BullMQ.
- Shared package: common schemas, DTOs, enums, and job contracts.
- Database: PostgreSQL with Prisma.
- Queue: Redis.
- GitHub integration: GitHub App.
- LLM integration: provider adapter with OpenAI-compatible default and mock provider.

## Boundaries

### Frontend

The frontend displays repositories, pull requests, review runs, summaries, findings, risk analysis, and posting state. It allows users to approve selected draft findings and submit them for GitHub posting.

It should not make final decisions about posting state, review state, or GitHub identity. Those are API/database concerns.

### API

The API owns:

- webhook signature verification
- GitHub App authentication
- receiving GitHub events
- storing repository and PR metadata
- enqueueing analysis jobs
- serving dashboard data
- accepting approval/posting requests
- posting approved review output to GitHub

Request handlers should stay thin. Long-running analysis belongs in the worker.

### Worker

The worker owns:

- fetching PR diffs and changed files
- gathering repository context
- applying token budgets
- calling the review provider
- aggregating and ranking findings
- saving review runs and draft findings

Worker jobs should be idempotent by GitHub installation, repository, pull request number, and head SHA.

### Shared Package

The shared package owns stable contracts used by multiple packages:

- review severity
- review category
- finding shape
- risk assessment shape
- review run status
- API DTOs
- queue payload schemas

Use schema validation at package boundaries.

### Database

PostgreSQL with Prisma should persist:

- GitHub installations
- repositories
- pull requests
- changed files
- analysis jobs
- review runs
- findings
- summaries
- posting state

### Queue

Redis and BullMQ should process pull request analysis asynchronously. Webhook handlers should enqueue work and return quickly.

### GitHub App

Use GitHub App installation tokens to fetch repository data and post approved output. Verify webhook signatures before processing events.

### LLM Provider

Use a provider interface so the review engine is not tightly coupled to one model vendor. The default implementation should be OpenAI-compatible, and local development should support a deterministic mock provider.

## Data Flow

1. GitHub sends a pull request webhook.
2. API verifies the webhook signature.
3. API stores or updates installation, repository, and PR records.
4. API enqueues an `analyze-pr` job.
5. Worker fetches changed files, diffs, and repository context.
6. Worker builds a review request for the provider.
7. Provider returns summary, findings, risks, and recommendations.
8. Worker ranks, deduplicates, validates, and stores draft results.
9. Frontend displays the draft review.
10. User approves selected output.
11. API posts approved comments and summary to GitHub.
12. API records posting results.

## Failure Handling

- Webhook processing should be idempotent.
- Duplicate jobs for the same head SHA should not create duplicate review runs.
- Provider failures should produce a failed review run with a readable error state.
- GitHub posting failures should not lose approved findings.
- The dashboard should expose pending, running, failed, draft, and posted states.

