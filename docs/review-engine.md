# Review Engine

## Purpose

The review engine produces high-signal pull request feedback using repository context. It should find issues that matter to correctness, architecture, reliability, security, testing, deployment, and maintainability.

It should not behave like a formatter or generic static analyzer.

## Review Categories

Use these categories for findings:

- `correctness`: logic errors, broken behavior, invalid assumptions, edge cases
- `security`: injection, authz/authn, secrets, unsafe data handling, dependency risk
- `architecture`: boundary violations, coupling, inconsistent patterns, service impact
- `performance`: avoidable latency, unnecessary work, scaling risks
- `testing`: missing or weak tests for changed behavior
- `observability`: missing logs, metrics, traces, or diagnosability for risky changes
- `maintainability`: confusing structure, brittle code, duplication with real cost
- `devex`: confusing workflows, local development breakage, poor ergonomics
- `deployment`: migrations, rollout risk, compatibility, config, environment issues

## Severity Model

Use four severities:

- `critical`: likely production breakage, exploitable security issue, data loss, or severe outage risk
- `high`: significant bug, security weakness, breaking change, or risky deployment issue
- `medium`: meaningful maintainability, testing, observability, or correctness concern
- `low`: minor but still actionable issue; avoid using this for pure preferences

The MVP should prefer fewer medium/high findings over many low-severity comments.

## Finding Structure

Each finding should include:

- file path
- line or range when available
- severity
- category
- concise title
- explanation of the risk
- evidence from the diff or repository context
- suggested fix or next step when useful

Inline comments should be tied to changed lines when possible. General architecture or testing notes can live in the review summary instead.

## Risk Assessment

Each review run should include practical risk signals:

- security risk
- deployment risk
- breaking-change probability
- maintainability impact
- testing confidence

Scores should be explainable. Avoid false precision; short labels and reasoning are more useful than complex numeric formulas in the MVP.

## Context Selection

Gather context in this order:

1. Pull request title, description, labels, base branch, head SHA, and author.
2. Changed files and patches.
3. Full contents of changed files when size allows.
4. Nearby imports and directly related files when cheaply discoverable.
5. Repository root docs such as `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, and architecture docs.
6. ADRs and docs under common paths like `docs/`, `adr/`, and `architecture/`.
7. Package manifests, lockfiles, config files, and test setup relevant to changed files.

Apply token budgeting before calling the provider. Prefer directly relevant files over broad repository scans.

## Noise Reduction

The review engine should:

- avoid style-only comments
- avoid restating obvious diff content
- avoid speculative findings without evidence
- deduplicate related findings
- rank by impact and confidence
- combine broad concerns into summary notes instead of many inline comments
- allow no findings when no high-confidence issue exists

## AI-Generated Code Safety

When reviewing code that appears AI-generated or unusually broad, pay special attention to:

- invented APIs or incorrect assumptions
- missing error handling
- shallow tests that only match the happy path
- security-sensitive defaults
- inconsistent project conventions
- overbroad abstractions
- code that compiles but does not fit the architecture

