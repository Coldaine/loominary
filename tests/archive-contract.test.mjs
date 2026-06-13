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

console.log('Archive contract mapper smoke test passed.');
