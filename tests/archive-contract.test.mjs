import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function loadArchiveContract() {
  const sourceUrl = new URL('../src/utils/archive/archiveContract.js', import.meta.url);
  const source = await readFile(sourceUrl, 'utf8');
  const encoded = Buffer.from(source).toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

const archive = await loadArchiveContract();

const processedData = {
  format: 'claude',
  meta_info: {
    title: 'Archive contract test',
    uuid: 'provider-alpha',
    created_at: '2026-05-07T12:00:00.000Z',
    updated_at: '2026-05-07T12:04:00.000Z',
    platform: 'claude',
    project_uuid: 'project-1',
    is_starred: true
  },
  chat_history: [
    {
      index: 0,
      uuid: 'msg-1',
      sender: 'human',
      sender_label: 'User',
      timestamp: '2026-05-07T12:00:00.000Z',
      display_text: 'Summarize the archive shape.',
      branch_id: 'main'
    },
    {
      index: 1,
      uuid: 'msg-2',
      parent_uuid: 'msg-1',
      sender: 'assistant',
      sender_label: 'Claude',
      timestamp: '2026-05-07T12:01:00.000Z',
      display_text: 'Use a narrow local archive contract.',
      branch_id: 'main',
      thinking: 'Keep provider details out of the contract.'
    },
    {
      index: 2,
      uuid: 'msg-3',
      parent_uuid: 'msg-2',
      sender: 'human',
      sender_label: 'User',
      timestamp: '2026-05-07T12:02:00.000Z',
      display_text: 'What about branches?',
      branch_id: 'main'
    },
    {
      index: 3,
      uuid: 'msg-4',
      parent_uuid: 'msg-2',
      sender: 'assistant',
      sender_label: 'Claude',
      timestamp: '2026-05-07T12:03:00.000Z',
      display_text: 'Represent branches without provider-specific trees.',
      branch_id: 'branch-a'
    }
  ]
};

const bundle = archive.buildArchiveBundle(processedData, {
  archiveId: 'test-archive',
  exportContext: {
    projectInfo: {
      uuid: 'project-1',
      name: 'Loominary Sprint 2',
      description: 'First local integration surface.',
      instructions: 'Keep outputs provider-agnostic and durable.',
      knowledgeFiles: [
        {
          uuid: 'kf-1',
          name: 'README.md',
          summary: 'Product promise and archive framing.'
        }
      ],
      memory: 'Keep the protocol narrow.'
    },
    userMemory: {
      memories: 'Favor local-first storage.'
    }
  },
  marks: {
    important: new Set([3]),
    completed: new Set(['msg-2'])
  },
  tags: ['research']
});

archive.validateManifest(bundle.manifest);
archive.validateConversationRecord(bundle.conversation);
archive.validateContextRecord(bundle.context);
archive.validateAnnotations(bundle.annotations);

assert.equal(bundle.manifest.archiveId, 'test-archive');
assert.equal(bundle.conversation.schemaVersion, archive.CONVERSATION_SCHEMA_VERSION);
assert.equal(bundle.conversation.conversation.id, 'provider-alpha');
assert.equal(bundle.conversation.conversation.platform, 'claude');
assert.equal(bundle.conversation.conversation.provider, 'anthropic');
assert.equal(bundle.conversation.conversation.favorite, true);
assert.equal(bundle.conversation.messages.length, 4);

const mainBranch = bundle.conversation.branches.find(branch => branch.id === 'main');
const alternateBranch = bundle.conversation.branches.find(branch => branch.id === 'branch-a');

assert.deepEqual(mainBranch.leafMessageIds, ['msg-3']);
assert.equal(alternateBranch.parentBranchId, 'main');
assert.deepEqual(alternateBranch.leafMessageIds, ['msg-4']);

const assistantMessage = bundle.conversation.messages.find(message => message.id === 'msg-2');
assert.equal(assistantMessage.parentId, 'msg-1');
assert.equal(assistantMessage.role, 'assistant');
assert.ok(assistantMessage.content.some(block => block.type === 'thinking'));

assert.equal(bundle.context.project.name, 'Loominary Sprint 2');
assert.equal(bundle.context.project.knowledgeFiles[0].id, 'kf-1');
assert.equal(bundle.context.memories.global[0].content, 'Favor local-first storage.');
assert.equal(bundle.context.memories.project[0].content, 'Keep the protocol narrow.');

assert.deepEqual(bundle.annotations.favorites, ['provider-alpha']);
assert.ok(bundle.annotations.tags.some(tag => tag.tag === 'important' && tag.messageId === 'msg-4'));
assert.ok(bundle.annotations.tags.some(tag => tag.tag === 'completed' && tag.messageId === 'msg-2'));
assert.ok(bundle.annotations.tags.some(tag => tag.tag === 'research' && !tag.messageId));

const chatgptSnapshot = {
  schemaVersion: archive.RAW_CAPTURE_SCHEMA_VERSION,
  provider: 'chatgpt',
  platform: 'chatgpt',
  capturedAt: '2026-06-14T10:00:00.000Z',
  capturedUrl: 'https://chatgpt.com/c/dom-alpha',
  conversationUrl: 'https://chatgpt.com/c/dom-alpha',
  conversationId: 'dom-alpha',
  title: 'DOM capture fixture',
  warnings: ['Captured from visible DOM only.'],
  messages: [
    {
      role: 'user',
      id: 'dom-user-1',
      text: 'Please inspect this image.',
      images: [{ src: 'https://example.test/image.png', alt: 'diagram', width: 640, height: 320 }],
      attachments: [{ name: 'notes.txt', url: 'https://example.test/notes.txt' }]
    },
    {
      role: 'assistant',
      text: 'The visible diagram shows an archive pipeline.',
      branchEvidence: ['Regenerate response'],
      warnings: ['Branch selector was visible, exact hidden branches were not captured.']
    }
  ]
};

const chatgptBundle = archive.buildArchiveBundleFromCapture(chatgptSnapshot);
const chatgptBundleAgain = archive.buildArchiveBundleFromCapture(chatgptSnapshot);

archive.validateConversationRecord(chatgptBundle.conversation);
archive.validateContextRecord(chatgptBundle.context);
archive.validateAnnotations(chatgptBundle.annotations);

assert.equal(chatgptBundle.conversation.conversation.id, 'dom-alpha');
assert.equal(chatgptBundle.conversation.conversation.platform, 'chatgpt');
assert.equal(chatgptBundle.conversation.conversation.provider, 'chatgpt');
assert.equal(chatgptBundle.conversation.conversation.capture.warnings[0], 'Captured from visible DOM only.');
assert.deepEqual(
  chatgptBundle.conversation.messages.map(message => message.id),
  chatgptBundleAgain.conversation.messages.map(message => message.id)
);
assert.equal(chatgptBundle.conversation.messages[0].content.some(block => block.type === 'image'), true);
assert.equal(chatgptBundle.conversation.messages[0].content.some(block => block.type === 'attachment'), true);
assert.equal(chatgptBundle.conversation.messages[1].metadata.branchEvidence[0], 'Regenerate response');
assert.equal(chatgptBundle.conversation.messages[1].metadata.captureWarnings[0], 'Branch selector was visible, exact hidden branches were not captured.');

const claudeSnapshot = {
  schemaVersion: archive.RAW_CAPTURE_SCHEMA_VERSION,
  provider: 'claude',
  platform: 'claude',
  capturedAt: '2026-06-14T11:00:00.000Z',
  capturedUrl: 'https://claude.ai/chat/claude-dom',
  conversationUrl: 'https://claude.ai/chat/claude-dom',
  conversationId: 'claude-dom',
  title: 'Claude DOM fixture',
  context: {
    projectInfo: {
      uuid: 'visible-project',
      name: 'Visible Project',
      instructions: 'Only visible instructions are captured.'
    }
  },
  messages: [
    { role: 'user', text: 'Show the rendered artifact.' },
    {
      role: 'assistant',
      text: 'Here is the rendered artifact.',
      artifacts: [{ title: 'hello.js', type: 'code', content: 'console.log("hello");' }]
    }
  ]
};

const claudeBundle = archive.buildArchiveBundleFromCapture(claudeSnapshot);
const claudeProcessed = archive.archiveConversationToProcessedData(claudeBundle.conversation, claudeBundle.context);

assert.equal(claudeBundle.context.project.name, 'Visible Project');
assert.equal(claudeBundle.conversation.messages[1].content.some(block => block.type === 'artifact'), true);
assert.equal(claudeProcessed.chat_history.length, 2);
assert.equal(claudeProcessed.chat_history[1].artifacts[0].title, 'hello.js');

console.log('Archive contract mapper smoke test passed.');
