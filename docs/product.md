# Product

## Vision

CodeSentinel is the safety layer between code changes and production. It reviews pull requests with repository awareness, architectural context, and practical engineering judgment.

The platform is especially useful for teams adopting AI-generated code. AI coding tools can move quickly, but they often introduce hidden assumptions, brittle logic, missing tests, or security gaps. CodeSentinel should help teams catch those issues before merge.

## Target Users

- Engineering teams using GitHub pull requests.
- Teams adopting AI coding assistants.
- Reviewers responsible for architecture, reliability, security, or production safety.
- Small teams that need more review capacity without accepting noisy automated feedback.

## Core Workflow

1. A pull request is opened, updated, reopened, or marked ready for review.
2. GitHub sends a webhook to CodeSentinel.
3. CodeSentinel fetches PR metadata, changed files, diffs, and repository context.
4. The review engine analyzes the change.
5. CodeSentinel stores a draft review.
6. A user opens the dashboard, inspects the summary and findings, and approves selected output.
7. CodeSentinel posts approved comments and summary back to GitHub.

## MVP Features

- GitHub App installation and webhook handling.
- PR metadata, changed file, and diff ingestion.
- Repository context gathering from docs, manifests, changed files, and nearby code.
- Draft review generation through an LLM provider adapter.
- Inline findings with severity and category.
- PR summary, risk analysis, architecture notes, and testing recommendations.
- Dashboard for viewing and approving draft reviews.
- Manual posting of approved output to GitHub.

## Deferred Features

The MVP should not include billing, team management, enterprise auth, advanced RBAC, full repository memory, semantic code graphs, IDE integration, Slack/Jira integration, auto-fix workflows, or advanced analytics.

These can be added after the core workflow proves that reviews are useful and low-noise.

## Product Philosophy

CodeSentinel should prioritize useful review outcomes over comment volume. A short review with one important finding is better than a long review full of generic suggestions.

The system should be willing to say there are no high-confidence findings. Silence is better than noise.

