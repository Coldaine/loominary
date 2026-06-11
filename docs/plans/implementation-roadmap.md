# Implementation Roadmap

## Current Read

The path forward is clear once the active branches are read together:

1. Make the existing browser app easier to change.
2. Define and implement the local archive/service surface.
3. Add the browser-to-archive writer that turns Loominary's captured data into durable local records.
4. Validate downstream consumers through HTTP and MCP-style tool calls.

`main` is the product baseline. The detailed plan material currently lives on active remote branches, so this document consolidates that direction in one place.

## Branch Disposition

| Branch | Disposition | Reason |
| --- | --- | --- |
| `codex/loom-sprint-1-refactor` | Revive first, but remove duplicate docs and unwanted lockfile before PR. | This is the lowest-risk foundation: it extracts import, search, export, ZIP, runtime, and file-management workflows from `src/App.js` and adds focused tests. |
| `codex/loom-sprint-2-local-service` | Rebase or rebuild after Sprint 1 lands. | This adds the local archive/service concept. It should build on the refactored seams rather than compete with them. |
| `codex/deps-loominary-safe-upgrades-20260402` | Keep as planning input only. | It documents dependency risk but intentionally avoids upgrades. Fold future dependency work into a focused upgrade PR. |
| `cleanup/add-gitignore-and-configs` | Do not revive as-is. | PR #1 was closed because agent configs and `package-lock.json` were not appropriate for this fork. |
| `entire/checkpoints/v1` | Ignore for product work. | It appears to be a metadata/checkpoint branch and deletes the app contents relative to `main`. |

## Sprint 1: Refactor the Browser App

Goal: make `src/App.js` an orchestrator rather than the owner of every workflow.

Planned ownership:

- `src/hooks/useFileManager.js`: file loading, parsing, metadata extraction, merged JSONL registration.
- `src/services/import/fileImportService.js`: shared parse/process pipeline for file management and global search.
- `src/services/import/conversationGroupingService.js`: JSONL branch grouping before merged import.
- `src/services/zip/zipConversationService.js`: ZIP import parsing and remote ZIP sync card refreshes.
- `src/hooks/useGlobalSearchIndex.js`: index rebuild timing.
- `src/utils/globalSearchManager.js`: indexing and querying.
- `src/services/export/exportOrchestrator.js`: Markdown/PDF export coordination and config lookup.
- `src/services/runtime/runtimeAdapterService.js`: extension and web runtime payload/session handling.

Acceptance checks:

- `App.js` mostly owns view state and UI composition.
- Import, search, export, ZIP, and runtime paths are independently testable.
- Jest tests cover the extracted services.
- README only links to these plans instead of duplicating sprint details.
- Any `package-lock.json` decision is made explicitly before PR.

## Sprint 2: Local Archive and Service

Goal: expose archived conversations and captured context to local tools without coupling consumers to provider-specific exports.

Planned deliverables:

- Versioned local archive JSON contract.
- Archive loader and validation helpers.
- In-memory search index built from source-of-truth archive files.
- Loopback HTTP service.
- Narrow MCP-style tool-call endpoint for local agents.
- Consumer examples and tests.

This work should not depend on containers on the local machine.

## Sprint 3: Browser-to-Archive Writer

Goal: close the biggest gap in the Sprint 2 branch: archive creation is not automated from the browser app.

Planned work:

- Map normalized parser output to `loominary.conversation/v1`.
- Map favorites and message marks to `loominary.annotations/v1`.
- Map project descriptions, instructions, memories, saved memories, and knowledge-file metadata to `loominary.context/v1`.
- Add an export/write path that can create or update an archive root.
- Preserve stable message IDs; do not use array indexes as durable tag targets.
- Add migration tests from sample Claude, ChatGPT, Grok, Gemini, and SillyTavern inputs where fixtures exist.

## Review Order

1. Land docs/plans consolidation.
2. Rework Sprint 1 into a clean PR without duplicate planning docs.
3. Rebuild Sprint 2 on top of Sprint 1.
4. Add browser-to-archive writer.
5. Run dependency upgrades only after the tests and export paths are strong enough to catch regressions.
