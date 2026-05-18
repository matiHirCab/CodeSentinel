# MVP Roadmap

## 1. Repo Scaffold And Tooling

Create a TypeScript monorepo with packages for frontend, API, worker, and shared types. Add linting, formatting, testing, environment validation, and base scripts for local development.

## 2. Database And Shared Types

Add PostgreSQL with Prisma. Define the initial data model for GitHub installations, repositories, pull requests, changed files, analysis jobs, review runs, findings, summaries, and posting state.

Create shared schemas for review severity, categories, risk assessment, review findings, review summaries, review run status, and queue payloads.

## 3. GitHub App Webhook Ingestion

Implement GitHub webhook verification and handle pull request events for opened, synchronize, reopened, and ready-for-review actions.

Store or update repository and pull request metadata, then enqueue an analysis job keyed by installation, repository, PR number, and head SHA.

## 4. PR Diff And Context Gathering

Fetch PR metadata, changed files, patches, and relevant file contents using GitHub App installation tokens.

Gather context from changed files, nearby imports, project manifests, README, AGENTS, CONTRIBUTING, architecture docs, and ADRs where available. Add token budgeting before provider calls.

## 5. Mock Review Provider

Implement the review provider interface and a deterministic mock provider. The mock should return stable sample summaries, findings, risk assessment, and testing recommendations so the product workflow can be tested without an LLM key.

## 6. Worker Orchestration

Implement the BullMQ `analyze-pr` worker. It should fetch context, call the provider, validate output, deduplicate and rank findings, and store a draft review run.

Jobs should be idempotent and safe to retry.

## 7. Dashboard And Draft Review UI

Build the frontend dashboard for repositories, pull requests, review runs, summaries, risks, files changed, findings, and posting state.

The PR review page should support selecting which draft findings should be posted.

## 8. Manual Approval And GitHub Posting

Add an API endpoint to post approved summaries and inline findings to GitHub. Record posting attempts, success, failure, and GitHub comment identifiers where available.

The MVP must require manual approval before posting.

## 9. Tests And Local Docker Setup

Add Docker Compose for PostgreSQL and Redis. Provide local development scripts for the API, worker, and frontend.

Add tests for webhook verification, idempotent job creation, diff normalization, context selection, provider contracts, worker persistence, posting behavior, and key frontend states.

