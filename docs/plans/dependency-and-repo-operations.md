# Dependency and Repo Operations

## Local Environment Rules

- Do not run Docker, Podman, or local containerized services on this machine.
- Use remote infrastructure for containerized tasks.
- Keep the local service loopback-only unless a future plan explicitly expands the trust model.

## Git and PR Rules

- Prefer an existing branch when it fits the work.
- Create a new branch only when no active branch is appropriate.
- Commit coherent chunks along the way.
- Open pull requests only when ready for review.
- Do not open draft PRs.
- When stopping or finishing work with local changes, open a PR.

## Fork-Specific Cleanup Decisions

PR #1 was closed with the note that generated agent configs and `package-lock.json` should not be committed to this fork. Treat that as the current fork policy unless it is explicitly reversed.

Do not revive these files as-is:

- `.claude/settings.json`
- `.gemini/settings.json`
- `.entire/settings.json`
- `.entire/.gitignore`
- `package-lock.json`

A minimal `.gitignore` may still be useful, but it should be proposed separately from agent/tool configuration and should not bring back the closed PR wholesale.

## Dependency Review Snapshot

The dependency review branch inspected these current ranges:

- `@xenova/transformers` `^2.17.2`
- `fflate` `^0.8.2`
- `file-saver` `^2.0.5`
- `html2canvas` `^1.4.1`
- `jspdf` `^3.0.3`
- `jszip` `^3.10.1`
- `katex` `^0.16.23`
- `lucide-react` `^0.511.0`
- `react` `^19.1.0`
- `react-dom` `^19.1.0`
- `react-markdown` `^8.0.7`
- `react-scripts` `5.0.1`
- `react-syntax-highlighter` `^15.5.0`
- `rehype-katex` `^7.0.1`
- `rehype-raw` `^7.0.0`
- `remark-gfm` `^3.0.1`
- `remark-math` `^6.0.0`

Outdated packages observed in that review:

- `jspdf`: `3.0.4` available, `4.2.1` latest at the time of review.
- `react`: `19.2.4` available at the time of review.
- `react-dom`: `19.2.4` available at the time of review.
- `katex`: `0.16.44` available at the time of review.
- `react-markdown`: `10.1.0` latest at the time of review.
- `react-syntax-highlighter`: `16.1.1` latest at the time of review.
- `remark-gfm`: `4.0.1` latest at the time of review.
- `lucide-react`: `1.7.0` latest at the time of review.

These version observations are historical. Re-run dependency checks before any upgrade PR.

## Dependency Upgrade Plan

Do not batch major dependency upgrades into refactor or local-service PRs.

Safe order:

1. Land the app refactor and service tests.
2. Re-run `npm outdated --json --long`.
3. Re-run `npm ls --depth=0 --json`.
4. Patch-update low-risk dependencies only when the build and relevant exports pass.
5. Handle major upgrades in separate PRs with focused compatibility checks.

High-risk areas:

- `jspdf` major upgrades require PDF export output verification.
- `react-markdown` and `remark-gfm` major upgrades require markdown rendering verification.
- `react-syntax-highlighter` upgrades require import/theme verification.
- `lucide-react` upgrades require icon import verification.

Minimum verification for upgrade PRs:

- production build
- markdown rendering smoke test
- PDF export smoke test
- parser/import fixtures where available
- local-service tests if the branch includes service code

## Test Command Plan

Sprint 1 proposes Jest tests for extracted browser-app services:

```bash
npm test
npm run test:ci
```

Sprint 2 proposes Node test-runner tests for the local service:

```bash
npm run test:local-service
```

Only document commands in `README.md` after the corresponding scripts and tests are actually present on `main`.
