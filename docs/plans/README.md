# Loominary Plans

This directory is the source of truth for proposed Loominary work. Keep forward-looking implementation plans, branch triage notes, and contributor operating instructions here.

## Plan Set

- [Implementation roadmap](implementation-roadmap.md) owns the product sequence, branch disposition, and sprint order.
- [Local archive and service plan](local-archive-service.md) owns the proposed archive contract, local HTTP surface, MCP surface, and browser-to-archive integration work.
- [Legacy feature audit](legacy-feature-audit.md) owns the comparison with older Lyra-line forks and records which legacy capabilities to keep, rebuild, defer, or drop.
- [Dependency and repo operations](dependency-and-repo-operations.md) owns dependency upgrade strategy plus local workflow and PR rules for this fork.

## Documentation Boundaries

- `README.md` should stay product-facing and short.
- `docs/plans/*` should hold proposed work that is not yet the default architecture.
- Future architecture docs should describe accepted system shape after implementation lands.
- Provider-specific facts should live near provider code or in a dedicated provider reference, not in these plans.
- Legacy fork findings should stay in `legacy-feature-audit.md` until a feature is accepted into the roadmap or implemented.

## Duplicate Documentation Cleanup

These plans consolidate the branch-only notes that were previously split across:

- `docs/sprint-1-architecture.md` on `codex/loom-sprint-1-refactor`
- `docs/local-archive-contract.md` on `codex/loom-sprint-2-local-service`
- `docs/local-service-consumer-guide.md` on `codex/loom-sprint-2-local-service`
- `DEPENDENCY_REVIEW.md` on `codex/deps-loominary-safe-upgrades-20260402`
- PR #1 comments about agent configs and `package-lock.json`

Do not re-add those duplicate root or top-level docs. If one of the active branches is revived, move any still-useful material into this directory and delete the old duplicate file from that branch before opening a new PR.
