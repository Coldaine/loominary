# DOM Capture Manual QA

Run these checks from the Chrome/Chromium extension build. Do not use Docker or local containers.

## ChatGPT

1. Open a visible conversation at `https://chatgpt.com/c/...`.
2. Click `Preview` in the Loominary panel.
3. Confirm Loominary opens the conversation from a `loominary.capture.raw/v1` payload.
4. Search for text from both a user and assistant message.
5. Export Markdown from the timeline.
6. Toggle `Images`, capture a conversation with a visible image, and confirm the image appears as archive metadata.
7. Click `Save All`, choose a small count from visible sidebar items, and confirm multiple local entries load.

## Claude

1. Open a visible conversation at `https://claude.ai/chat/...`.
2. Click `Preview` in the Loominary panel.
3. Confirm messages load without any `/api/organizations/*` requests.
4. Capture a conversation with an artifact or code block and confirm it appears in message details.
5. Capture with a visible project/context side panel and confirm context is recorded only from visible DOM.
6. Click `Save All`, choose a small count from visible sidebar items, and confirm partial failures are represented as warnings.

## Regression Checks

1. Run `npm run test:capture`.
2. Run `rg "backend-api|api/organizations|accessToken|oai-device|chatGPTToken|claudeUserId|ensureAccessToken" src build.py`.
3. Confirm the scan reports no active private endpoint or credential capture paths.
