# Local Archive and Service Plan

## Purpose

Loominary should expose a small local-first archive that other tools can consume. The archive should be provider-agnostic, durable on disk, and easy to search from local AI clients.

## Design Goals

- Keep the archive JSON files as the durable source of truth.
- Normalize provider exports into stable conversation, branch, message, annotation, and context records.
- Keep rebuildable state, such as search indexes and tree projections, out of the durable contract.
- Store captured context beside the conversation it belongs to.
- Bind local services to loopback by default.
- Support an optional bearer token for stricter local setups.

## On-Disk Layout

```text
archive-root/
  manifest.json
  annotations.json
  conversations/
    <conversation-id>.json
  contexts/
    <conversation-id>.json
```

Source of truth:

- `manifest.json`
- `annotations.json`
- `conversations/*.json`
- `contexts/*.json`

Derived state:

- full-text search indexes
- conversation summary views
- branch tree projections

Derived state can be rebuilt at service startup. Consumers should not treat indexes as canonical.

## Manifest Contract

```json
{
  "schemaVersion": "loominary.archive/v1",
  "archiveId": "workspace-or-user-archive",
  "createdAt": "2026-05-08T00:00:00.000Z",
  "updatedAt": "2026-05-08T00:00:00.000Z",
  "layout": {
    "conversationsDir": "conversations",
    "contextsDir": "contexts",
    "annotationsFile": "annotations.json"
  },
  "lifecycle": {
    "sourceOfTruth": [
      "manifest.json",
      "conversations/*.json",
      "contexts/*.json",
      "annotations.json"
    ],
    "derivedIndexes": [
      "rebuild-in-memory"
    ]
  },
  "trust": {
    "defaultBind": "127.0.0.1",
    "authMode": "loopback-or-token"
  }
}
```

## Conversation Contract

Each conversation is a self-contained normalized record.

```json
{
  "schemaVersion": "loominary.conversation/v1",
  "conversation": {
    "id": "conv-alpha",
    "title": "Sprint architecture notes",
    "platform": "claude",
    "provider": "anthropic",
    "providerConversationId": "provider-alpha",
    "createdAt": "2026-05-07T12:00:00.000Z",
    "updatedAt": "2026-05-08T02:00:00.000Z",
    "favorite": true
  },
  "branches": [
    {
      "id": "main",
      "rootMessageId": "msg-1",
      "leafMessageIds": ["msg-3", "msg-4"]
    }
  ],
  "messages": [
    {
      "id": "msg-1",
      "parentId": null,
      "branchId": "main",
      "role": "user",
      "createdAt": "2026-05-07T12:00:00.000Z",
      "text": "Summarize the local archive shape for Loominary.",
      "content": [
        {
          "type": "text",
          "text": "Summarize the local archive shape for Loominary."
        }
      ]
    }
  ]
}
```

Rules:

- `conversation.id` is Loominary-local and stable within the archive.
- `providerConversationId` is optional provider metadata and not the primary key.
- `messages[].text` is the consumer-friendly plain text projection.
- `messages[].content` preserves extensible typed blocks.
- `branches[]` describes branch membership without exposing provider-specific tree formats.

## Context Contract

Context lives beside the conversation, not mixed into message bodies.

```json
{
  "schemaVersion": "loominary.context/v1",
  "conversationId": "conv-alpha",
  "project": {
    "id": "project-1",
    "name": "Loominary Sprint 2",
    "description": "First local integration surface.",
    "instructions": "Keep outputs provider-agnostic and durable.",
    "knowledgeFiles": [
      {
        "id": "kf-1",
        "name": "README.md",
        "summary": "Product promise and archive framing."
      }
    ]
  },
  "memories": {
    "global": [],
    "project": [],
    "saved": []
  }
}
```

This covers:

- project descriptions and instructions
- project memories
- saved memories
- knowledge-file metadata

## Annotations Contract

Tags and favorites are normalized into a single annotations file.

```json
{
  "schemaVersion": "loominary.annotations/v1",
  "favorites": ["conv-alpha"],
  "tags": [
    {
      "tag": "important",
      "conversationId": "conv-alpha",
      "messageId": "msg-2",
      "createdAt": "2026-05-08T00:00:00.000Z",
      "source": "loominary"
    }
  ]
}
```

Rules:

- Favorites are conversation-level only.
- Tags can target a whole conversation or a specific message.
- Message tags stay stable through `messageId`, not array index.

## Local Trust Model

Default behavior:

- Bind only to `127.0.0.1`.
- Treat loopback traffic as trusted when no token is configured.
- If `LOOMINARY_LOCAL_TOKEN` is set, require `Authorization: Bearer <token>` even on loopback.

Non-goals for v1:

- multi-user auth
- remote exposure
- browser-session identity forwarding

## HTTP Surface

Planned endpoints:

- `GET /health`
- `GET /v1/conversations`
- `GET /v1/search?q=<query>`
- `GET /v1/conversations/:conversationId`
- `GET /v1/conversations/:conversationId/tree`
- `GET /v1/conversations/:conversationId/context`
- `GET /v1/tags`
- `GET /v1/favorites`
- `POST /mcp`

Example service start:

```bash
node server/loominary-local-service.mjs --archive /path/to/your/archive --port 3788
```

Optional auth:

```bash
LOOMINARY_LOCAL_TOKEN=dev-token node server/loominary-local-service.mjs --archive /path/to/your/archive
```

## MCP-Style Surface

The v1 MCP-style endpoint should stay narrow and tool-call oriented.

Expected tool families:

- list conversations
- search conversations
- fetch a conversation
- fetch branch tree
- fetch attached context
- list tags
- list favorites

Consumers should:

- Treat conversation IDs as Loominary-local IDs.
- Prefer `messages[].text` for simple prompt/context assembly.
- Use `messages[].content` when typed rendering matters.
- Pull context separately so tools can choose when to include project instructions or saved memories.
- Avoid depending on provider-specific payloads.

## Mapping From Current Loominary State

- browser `localStorage` favorites map -> `annotations.favorites`
- browser mark/tag state -> `annotations.tags`
- normalized parser output `chat_history` -> `messages`
- detected branches -> `branches`
- export-time project/memory payloads -> `contexts/<conversation-id>.json`

Initial browser-side mapping lives in `src/utils/archive/archiveContract.js`. It mirrors the v1 service contract so Sprint 2 can consume the same record shape that the current parser layer emits.

## Current Limitations

- Archive creation is not yet automated from the browser app.
- Search is in-memory and rebuilt at startup.
- File watching is not part of v1.
- Persisted indexes are not part of v1.
- The MCP-style endpoint is intentionally narrow.

## Next Implementation Steps

1. Add generated archive fixtures for representative Claude, ChatGPT, Grok, Gemini, and SillyTavern parser outputs.
2. Land the browser app refactor so archive writing can hook into clean import/export seams.
3. Rebase or rebuild the service branch on top of the refactor and browser-side contract mapper.
4. Implement browser-to-archive writing.
5. Add tests that compare generated archive records against the v1 contract.
6. Add file watching or persisted indexes only after the source-of-truth contract is stable.
