# GitHub Issues Backlog

These issues divide the CodeSentinel MVP into actionable implementation slices. They are ordered so each issue can be created in GitHub and worked independently where possible.

## Issue 1: MVP tracking - repository-aware PR review workflow

### Goal

Deliver the first usable CodeSentinel MVP: GitHub PR webhook ingestion, queued analysis, repository context gathering, draft AI review generation, dashboard review, manual approval, and GitHub posting.

### Scope

This is the parent tracking issue for the initial MVP.

### Tasks

- Track completion of the MVP implementation issues.
- Keep the MVP aligned with `README.md`, `AGENTS.md`, and the docs under `docs/`.
- Defer billing, team management, enterprise auth, advanced RBAC, full repository memory, semantic code graphs, IDE extension, Slack/Jira integration, and auto-fix workflows.

### Acceptance Criteria

- A PR webhook can produce a stored draft review run.
- The dashboard can display the review summary, risks, findings, and posting state.
- A user can approve selected draft output and post it to GitHub.
- Local development setup is documented and reproducible.

---

## Issue 2: Scaffold TypeScript monorepo and base tooling

### Goal

Create the base project structure for the CodeSentinel MVP.

### Tasks

- Add a TypeScript monorepo with packages/apps for frontend, API, worker, and shared types.
- Configure package manager workspaces.
- Add TypeScript base config and per-package configs.
- Add linting, formatting, and test tooling.
- Add base scripts for development, build, test, lint, and typecheck.
- Add typed environment validation foundation.

### Acceptance Criteria

- `frontend`, `api`, `worker`, and `shared` workspaces exist.
- The repo has one command each for install, dev, build, test, lint, and typecheck.
- Empty package entrypoints compile.
- Tooling is documented in `README.md`.

### Depends On

- Context docs are present.

---

## Issue 3: Add PostgreSQL, Prisma schema, and shared review contracts

### Goal

Define the MVP data model and shared application contracts.

### Tasks

- Add Prisma configured for PostgreSQL.
- Model GitHub installations, repositories, pull requests, changed files, analysis jobs, review runs, findings, summaries, and posting state.
- Add shared schemas/types for review severity, review category, risk assessment, findings, summaries, review run status, and queue payloads.
- Add migration and seed/dev reset scripts where useful.
- Add validation for data crossing API, worker, and provider boundaries.

### Acceptance Criteria

- Prisma schema represents the MVP workflow from webhook ingestion through posting state.
- Shared types are usable from API, worker, and frontend packages.
- Database migration runs locally against PostgreSQL.
- Unit tests cover shared schemas and key validation failures.

### Depends On

- Issue 2.

---

## Issue 4: Implement GitHub App webhook ingestion

### Goal

Receive GitHub pull request webhook events and enqueue analysis work.

### Tasks

- Add Fastify API route for `POST /webhooks/github`.
- Verify GitHub webhook signatures.
- Parse pull request events for `opened`, `synchronize`, `reopened`, and `ready_for_review`.
- Store or update installation, repository, and pull request metadata.
- Enqueue an `analyze-pr` job keyed by installation, repository, PR number, and head SHA.
- Make processing idempotent for duplicate webhook deliveries.

### Acceptance Criteria

- Invalid signatures are rejected.
- Unsupported event types are ignored safely.
- Supported PR events create or update records and enqueue one analysis job per unique head SHA.
- Tests cover signature verification, supported actions, unsupported actions, and duplicate delivery behavior.

### Depends On

- Issue 3.

---

## Issue 5: Implement PR diff and repository context gathering

### Goal

Fetch the code and repository context needed for meaningful PR review.

### Tasks

- Implement GitHub App installation-token client.
- Fetch PR metadata, changed files, patches, and relevant file contents.
- Gather repository docs such as `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, architecture docs, and ADRs.
- Gather package manifests, relevant config files, and nearby directly related files when cheaply discoverable.
- Add context prioritization and token budgeting.
- Normalize changed files and patches into worker-friendly structures.

### Acceptance Criteria

- Context gathering works from installation, repository, PR number, and head SHA.
- Missing optional docs do not fail analysis.
- Oversized context is trimmed deterministically.
- Tests cover changed-file normalization, missing files, token budgeting, and context priority order.

### Depends On

- Issue 4.

---

## Issue 6: Add review provider interface and deterministic mock provider

### Goal

Create the LLM abstraction used by the review engine and make local development possible without an LLM key.

### Tasks

- Define a provider interface for PR review requests and responses.
- Define request shape for metadata, diff, context files, and repository signals.
- Define response shape for summary, findings, risks, architecture notes, and testing recommendations.
- Implement deterministic mock provider output.
- Add an OpenAI-compatible provider stub or adapter shell behind environment configuration.
- Validate provider responses before storing them.

### Acceptance Criteria

- Worker code can call the provider through a stable interface.
- Mock provider returns stable output for tests and local development.
- Invalid provider responses are rejected with useful errors.
- Tests cover provider contract validation and mock output.

### Depends On

- Issue 3.
- Issue 5 can run in parallel but should integrate before worker completion.

---

## Issue 7: Implement BullMQ analysis worker orchestration

### Goal

Process queued pull request analysis jobs and persist draft review runs.

### Tasks

- Add Redis/BullMQ worker process for `analyze-pr` jobs.
- Load PR/job metadata from the database.
- Fetch diff and repository context.
- Call the configured review provider.
- Validate, deduplicate, and rank findings.
- Store draft review summary, risk assessment, findings, and recommendations.
- Mark review runs as pending, running, draft, failed, or superseded where appropriate.
- Make jobs safe to retry.

### Acceptance Criteria

- A queued job can produce a persisted draft review run using the mock provider.
- Duplicate jobs for the same head SHA do not create duplicate active review runs.
- Provider failure produces a failed review run with a readable error.
- Tests cover successful run, duplicate run, retry behavior, and provider failure.

### Depends On

- Issue 5.
- Issue 6.

---

## Issue 8: Build dashboard and draft review UI

### Goal

Create the MVP frontend for inspecting repositories, PR review runs, draft findings, and posting state.

### Tasks

- Add repository list view.
- Add pull request/review run list view.
- Add review detail view with summary, risks, changed files, findings, architecture notes, and testing recommendations.
- Add finding selection controls for manual approval.
- Display pending, running, failed, draft, and posted states.
- Add API client layer using shared response types.

### Acceptance Criteria

- A user can navigate from repository to PR review run detail.
- Draft findings can be selected or deselected before posting.
- Failed and empty states are understandable.
- Frontend tests cover core render states and selection behavior.

### Depends On

- Issue 3.
- Issue 7 for live data integration.

---

## Issue 9: Implement manual approval and GitHub posting

### Goal

Allow users to post approved draft review output back to GitHub.

### Tasks

- Add API endpoint for posting approved review output.
- Accept selected finding identifiers and summary approval state.
- Validate that only draft, unposted review output can be posted.
- Post approved inline comments and summary through the GitHub App installation token.
- Record posting attempts, success, failure, and GitHub comment identifiers where available.
- Preserve approved findings if GitHub posting fails.

### Acceptance Criteria

- The API refuses to post unapproved or already-posted output.
- Approved findings and summary can be posted to GitHub through a mocked GitHub client.
- Posting failures are persisted and visible to the frontend.
- Tests cover success, partial failure, duplicate post attempt, and invalid finding selection.

### Depends On

- Issue 7.
- Issue 8 for frontend approval flow.

---

## Issue 10: Add local Docker setup and end-to-end MVP verification

### Goal

Make the MVP reproducible locally and verify the full workflow.

### Tasks

- Add Docker Compose for PostgreSQL and Redis.
- Add `.env.example` with required local settings.
- Add local development scripts for API, worker, frontend, database migration, and queue dependencies.
- Add sample GitHub webhook payloads for local testing.
- Document how to run the mock-provider flow end to end.
- Add integration tests for webhook-to-draft-review flow.
- Add integration tests for approved posting with mocked GitHub client.

### Acceptance Criteria

- A new developer can start Postgres and Redis locally.
- API, worker, and frontend can run together.
- A sample webhook can create a draft review using the mock provider.
- The dashboard can display the generated draft review.
- The posting path can be verified with a mocked GitHub client.

### Depends On

- Issue 2.
- Issue 4.
- Issue 7.
- Issue 8.
- Issue 9.

