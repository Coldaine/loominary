# Legacy Feature Audit

## Purpose

This audit keeps the pivot honest. Older Lyra-line forks preserve useful ideas, but Loominary should not blindly merge an old feature pile back into the rewrite. Use this document to decide which legacy capabilities support the archive-first product direction.

## Sources Reviewed

- `Laumss/loominary`: current upstream source baseline; `main` matches this fork's `main`.
- `Laumss/loominary` issue #22: rewrite/new-repo announcement and delayed timeline.
- `Laumss/loominary` discussion #26: maintainer note that core code was still not pushed and development was slower than planned.
- `Laumss/loominary` discussion #25: compliance concern and maintainer note that official provider exports were on the roadmap.
- `cristiannegru/lyra-exporter`: richest old Lyra-line feature surface found.
- `acrinym/lyra-exporter`: old Lyra-line feature surface with minor later mobile CSS work.
- `rebots-online/chatbot-lyra-exporter`: old Lyra copy plus project index files.
- `camillanapoles/lyra-exporter`: old Lyra copy plus docs/security/GitHub Pages guidance.
- `bdmorin/lyra-exporter-english`: older English translation fork.

## Fork Read

The newer Loominary forks appear to largely track upstream `main` based on cursory review, and no meaningful product-feature additions were identified during this audit. The old Lyra-line forks contain more features, but they represent the pre-rewrite architecture that upstream said had become brittle.

Most useful reference repo: `cristiannegru/lyra-exporter`.

Do not merge that repo wholesale. Mine it for behavior, fixtures, and user expectations.

## Capability Decisions

| Capability | Current Loominary baseline | Legacy/nearby signal | Decision | Rationale |
| --- | --- | --- | --- | --- |
| Multi-platform import/export | Present for Claude, ChatGPT, Gemini, Grok, NotebookLM, Google AI Studio, and SillyTavern. | Strongly present in old Lyra. | Keep and harden. | This is the core user value and feeds the archive. |
| Realtime branch capture | Present in product promise and provider adapters. | Strongly present in old Lyra. | Keep, but isolate. | Useful, but provider DOM capture should stay behind adapters. |
| Provider-issued export import | Partly present through parser paths. | Discussion #25 says this should become more important. | Promote. | Better compliance posture and more durable ingestion path. |
| Local archive contract | Planned in Sprint 2 branch. | Not present as a stable old Lyra contract. | Build now. | This is the new purpose. |
| Local HTTP/MCP archive service | Planned in Sprint 2 branch. | Old Lyra has MCP client UI, not this service contract. | Build now. | Enables local AI tools to consume Loominary data cleanly. |
| In-app AI chat panel | Not present in current rewrite source. | `cristiannegru/lyra-exporter` has `src/ai-chat/*`. | Defer. | It may be useful later, but archive service should come first. |
| MCP client/server manager UI | Translation strings exist in current baseline; implementation is not wired. | Old Lyra has MCP service/client modules and settings UI. | Defer and redesign. | Avoid confusing MCP-as-client with MCP-as-archive-service. |
| Whiteboard/canvas workspace | Current baseline has strings and some canvas handling, but not the full workspace source. | Old Lyra has `WhiteboardView`, canvas manager, and whiteboard components. | Defer. | Valuable as a consumer UI after archive primitives exist. |
| Semantic search UI | Product promise exists; old Lyra has panel/manager modules. | Present in old Lyra. | Rebuild later on archive index. | Search should be tied to durable records, not just UI state. |
| Long screenshot export | README currently marks long screenshots as not active. | Old Lyra has screenshot export modules. | Defer. | Lower priority than Markdown/PDF/archive correctness. |
| Mobile optimization | Current README says mobile support is in progress. | Old Lyra has mobile-specific panels/styles. | Revisit after Sprint 1. | Useful, but should follow component/service cleanup. |
| Tauri desktop app | Scripts exist. | Old Lyra carried Tauri dependencies. | Defer. | Packaging is not the bottleneck yet. |
| GitHub Pages/deployment docs | Not central to product. | Some forks add deployment/security docs. | Drop for now. | Does not advance archive-first development. |

## Execution Rules

- Rebuild behavior from tests and contracts, not by bulk-copying old files.
- Use old Lyra modules to discover edge cases, especially branch handling, semantic search, screenshot export, and AI chat context flow.
- Do not reintroduce `package-lock.json`, agent configs, or tool-local settings unless the fork policy changes.
- Any revived legacy capability must name the archive concept it strengthens.
- Any feature that does not strengthen capture, normalization, archive durability, search, export, or local tool consumption waits.

## Immediate Pivot Queue

1. Fix PR #2 review comments and merge the consolidated plans.
2. Re-scope Sprint 1 around refactoring import/export/search/runtime seams only.
3. Add focused tests for parser output and branch grouping before changing behavior.
4. Rebuild Sprint 2 archive service on top of the refactored seams.
5. Add official export fixtures and mapping tests.
6. Revisit old Lyra AI chat/MCP client only after the local archive service can serve real records.

## Open Questions

- Which provider-issued exports should be first-class fixtures: Claude, ChatGPT, or both?
- Should realtime capture remain enabled by default, or become an advanced/provider-specific mode?
- Should the first local consumer be HTTP-only, MCP-only, or both behind the same service?
- Which old Lyra whiteboard behaviors are essential enough to become archive consumer requirements?
