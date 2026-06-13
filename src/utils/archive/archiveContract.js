export const ARCHIVE_SCHEMA_VERSION = 'loominary.archive/v1';
export const CONVERSATION_SCHEMA_VERSION = 'loominary.conversation/v1';
export const CONTEXT_SCHEMA_VERSION = 'loominary.context/v1';
export const ANNOTATIONS_SCHEMA_VERSION = 'loominary.annotations/v1';

export const ROOT_MESSAGE_UUID = '00000000-0000-4000-8000-000000000000';

const DEFAULT_LAYOUT = {
  conversationsDir: 'conversations',
  contextsDir: 'contexts',
  annotationsFile: 'annotations.json'
};

const PROVIDER_BY_PLATFORM = {
  aistudio: 'google',
  chatgpt: 'openai',
  claude: 'anthropic',
  claude_code: 'anthropic',
  copilot: 'microsoft',
  gemini: 'google',
  gemini_notebooklm: 'google',
  grok: 'xai',
  jsonl_chat: 'sillytavern',
  notebooklm: 'google',
  sillytavern: 'sillytavern'
};

const MARK_TYPES = ['completed', 'important', 'deleted'];

const hasRecordValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const compactRecord = (record) => Object.fromEntries(
  Object.entries(record).filter(([, value]) => hasRecordValue(value))
);

const safeStringify = (value) => {
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
};

const asText = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return safeStringify(value);
};

const toArchiveDate = (value) => {
  if (!value) return null;

  if (typeof value === 'number') {
    const epoch = value < 1e12 ? value * 1000 : value;
    const date = new Date(epoch);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const text = String(value).trim();
  if (!text) return null;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
};

export const hashArchiveId = (value) => {
  const text = String(value || '');
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
};

export const buildStableArchiveId = (prefix, parts) => {
  const body = parts
    .filter(value => value !== undefined && value !== null && value !== '')
    .map(value => asText(value))
    .join('|');

  return `${prefix}-${hashArchiveId(body)}`;
};

const normalizePlatform = (platform, format) => {
  const raw = String(platform || format || 'unknown').toLowerCase();

  if (raw === 'jsonl_chat') return 'sillytavern';
  if (raw === 'gemini_notebooklm') return 'gemini';

  return raw;
};

const inferProvider = (platform, format) => {
  const key = String(platform || format || '').toLowerCase();
  return PROVIDER_BY_PLATFORM[key] || PROVIDER_BY_PLATFORM[normalizePlatform(platform, format)] || null;
};

const getMessageText = (message) => {
  const direct = message.display_text || message.text || message.raw_text;
  if (direct) return asText(direct);

  if (Array.isArray(message.content_items)) {
    return message.content_items
      .map(item => {
        if (!item || typeof item !== 'object') return asText(item);
        return item.text || item.content || '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map(item => {
        if (!item || typeof item !== 'object') return asText(item);
        return item.text || item.content || '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return asText(message.content || '');
};

const normalizeRole = (sender) => {
  const value = String(sender || '').toLowerCase();
  if (value === 'human' || value === 'user') return 'user';
  if (value === 'assistant' || value === 'ai' || value === 'bot') return 'assistant';
  if (value === 'system') return 'system';
  if (value === 'tool') return 'tool';
  return value || 'assistant';
};

const normalizeBranchId = (message) => message.branch_id || message.branchId || 'main';

const getDirectMessageId = (message) => {
  const id = message.uuid || message.id || message.responseId || '';
  const text = String(id).trim();
  return text && text !== ROOT_MESSAGE_UUID ? text : '';
};

const buildFallbackMessageId = (message, index, conversationId) => buildStableArchiveId('msg', [
  conversationId,
  message.sender,
  message.sender_label,
  message.timestamp || message.created_at,
  getMessageText(message),
  index
]);

const buildMessageIdentityMaps = (messages, conversationId) => {
  const sourceIdToArchiveId = new Map();
  const archiveIds = new Set();

  messages.forEach((message, index) => {
    const directId = getDirectMessageId(message);
    const fallbackId = buildFallbackMessageId(message, index, conversationId);
    let archiveId = directId || fallbackId;

    if (archiveIds.has(archiveId)) {
      archiveId = buildStableArchiveId('msg', [archiveId, index, getMessageText(message)]);
    }

    archiveIds.add(archiveId);
    sourceIdToArchiveId.set(directId || fallbackId, archiveId);
    sourceIdToArchiveId.set(fallbackId, archiveId);
  });

  return sourceIdToArchiveId;
};

const normalizeAttachmentBlock = (attachment) => compactRecord({
  type: 'attachment',
  id: attachment.id || attachment.uuid,
  fileName: attachment.file_name || attachment.name,
  fileType: attachment.file_type || attachment.mimeType || attachment.mime_type,
  fileSize: attachment.file_size || attachment.size,
  link: attachment.link || attachment.url || attachment.download_url || attachment.href,
  extractedContent: attachment.extracted_content || attachment.extractedContent,
  embeddedImage: attachment.embedded_image || null,
  isEmbeddedImage: attachment.is_embedded_image || false
});

const normalizeImageBlock = (image) => compactRecord({
  type: 'image',
  id: image.id || image.uuid || image.file_uuid,
  fileName: image.file_name || image.name,
  fileType: image.file_type || image.mimeType || image.format,
  fileSize: image.file_size || image.size || image.embedded_image?.size,
  displayMode: image.display_mode,
  source: image.source,
  url: image.url || image.file_url || image.preview_url || image.thumbnail_url || image.original_src,
  embeddedImage: image.embedded_image || null
});

const normalizeCitationBlock = (citation) => compactRecord({
  type: 'citation',
  id: citation.id,
  title: citation.title,
  url: citation.url,
  text: citation.text || citation.snippet,
  metadata: citation.metadata
});

const normalizeToolBlock = (tool) => compactRecord({
  type: 'tool',
  name: tool.name,
  input: tool.input,
  result: tool.result,
  query: tool.query
});

const normalizeArtifactBlock = (artifact) => compactRecord({
  type: 'artifact',
  id: artifact.id,
  command: artifact.command,
  title: artifact.title,
  language: artifact.language,
  artifactType: artifact.type,
  content: artifact.content,
  result: artifact.result
});

const buildContentBlocks = (message) => {
  const text = getMessageText(message);
  const blocks = [];

  if (text) {
    blocks.push({ type: 'text', text });
  }

  if (message.thinking) {
    blocks.push({
      type: 'thinking',
      text: asText(message.thinking)
    });
  }

  (message.tools || []).forEach(tool => {
    blocks.push(normalizeToolBlock(tool));
  });

  (message.artifacts || []).forEach(artifact => {
    blocks.push(normalizeArtifactBlock(artifact));
  });

  (message.images || []).forEach(image => {
    blocks.push(normalizeImageBlock(image));
  });

  (message.attachments || []).forEach(attachment => {
    blocks.push(normalizeAttachmentBlock(attachment));
  });

  (message.citations || []).forEach(citation => {
    blocks.push(normalizeCitationBlock(citation));
  });

  return blocks.length > 0 ? blocks : [{ type: 'text', text: '' }];
};

const normalizeMessage = (message, index, conversationId, sourceIdToArchiveId) => {
  const directId = getDirectMessageId(message);
  const fallbackId = buildFallbackMessageId(message, index, conversationId);
  const id = sourceIdToArchiveId.get(directId || fallbackId) || fallbackId;
  const parentSourceId = message.parent_uuid || message.parentId || message.parent_message_uuid;
  const parentId = parentSourceId && parentSourceId !== ROOT_MESSAGE_UUID
    ? sourceIdToArchiveId.get(parentSourceId) || parentSourceId
    : null;
  const metadata = compactRecord({
    sourceIndex: Number.isInteger(message.index) ? message.index : index,
    sender: message.sender,
    senderLabel: message.sender_label,
    branchLevel: message.branch_level,
    isBranchPoint: message.is_branch_point || false,
    stopReason: message.stop_reason
  });

  return compactRecord({
    id,
    parentId,
    role: normalizeRole(message.sender),
    branchId: normalizeBranchId(message),
    createdAt: toArchiveDate(message.timestamp || message.created_at || message.createdAt),
    text: getMessageText(message),
    content: buildContentBlocks(message),
    metadata
  });
};

const sortBranchIds = (left, right) => {
  if (left === 'main') return -1;
  if (right === 'main') return 1;
  return left.localeCompare(right);
};

const buildBranches = (messages) => {
  const byId = new Map(messages.map(message => [message.id, message]));
  const childrenByParent = new Map();
  const byBranch = new Map();

  messages.forEach(message => {
    if (!byBranch.has(message.branchId)) byBranch.set(message.branchId, []);
    byBranch.get(message.branchId).push(message);

    if (message.parentId) {
      if (!childrenByParent.has(message.parentId)) childrenByParent.set(message.parentId, []);
      childrenByParent.get(message.parentId).push(message);
    }
  });

  return Array.from(byBranch.keys()).sort(sortBranchIds).map(branchId => {
    const branchMessages = byBranch.get(branchId);
    const root = branchMessages.find(message => {
      const parent = message.parentId ? byId.get(message.parentId) : null;
      return !parent || parent.branchId !== branchId;
    }) || branchMessages[0];
    const parent = root?.parentId ? byId.get(root.parentId) : null;
    const leafMessageIds = branchMessages
      .filter(message => !(childrenByParent.get(message.id) || []).some(child => child.branchId === branchId))
      .map(message => message.id);

    return compactRecord({
      id: branchId,
      parentBranchId: parent && parent.branchId !== branchId ? parent.branchId : null,
      rootMessageId: root?.id,
      leafMessageIds
    });
  });
};

const getConversationIdentity = (processedData, options = {}) => {
  const meta = processedData?.meta_info || {};
  const format = processedData?.format || meta.format;
  const platform = normalizePlatform(processedData?.platform || meta.platform, format);
  const providerConversationId = options.providerConversationId || meta.uuid || processedData?.conversationId || null;
  const conversationId = options.conversationId || providerConversationId || buildStableArchiveId('conv', [
    platform,
    meta.title,
    meta.created_at,
    meta.updated_at,
    processedData?.chat_history?.length || 0
  ]);

  return {
    conversationId,
    providerConversationId,
    platform,
    provider: options.provider || inferProvider(processedData?.platform || meta.platform, format)
  };
};

export function buildArchiveManifest(options = {}) {
  const now = toArchiveDate(options.now || new Date()) || new Date().toISOString();

  return {
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    archiveId: options.archiveId || 'loominary-local-archive',
    createdAt: toArchiveDate(options.createdAt) || now,
    updatedAt: toArchiveDate(options.updatedAt) || now,
    layout: options.layout || DEFAULT_LAYOUT,
    lifecycle: {
      sourceOfTruth: [
        'manifest.json',
        'conversations/*.json',
        'contexts/*.json',
        'annotations.json'
      ],
      derivedIndexes: ['rebuild-in-memory']
    },
    trust: {
      defaultBind: options.defaultBind || '127.0.0.1',
      authMode: options.authMode || 'loopback-or-token'
    }
  };
}

export function buildConversationArchive(processedData, options = {}) {
  if (!processedData || typeof processedData !== 'object') {
    throw new Error('Processed conversation data must be an object.');
  }

  if (!Array.isArray(processedData.chat_history)) {
    throw new Error('Processed conversation data is missing chat_history.');
  }

  const meta = processedData.meta_info || {};
  const identity = getConversationIdentity(processedData, options);
  const sourceIdToArchiveId = buildMessageIdentityMaps(processedData.chat_history, identity.conversationId);
  const messages = processedData.chat_history.map((message, index) => (
    normalizeMessage(message, index, identity.conversationId, sourceIdToArchiveId)
  ));

  return {
    schemaVersion: CONVERSATION_SCHEMA_VERSION,
    conversation: compactRecord({
      id: identity.conversationId,
      title: meta.title || options.title || 'Untitled conversation',
      platform: identity.platform,
      provider: identity.provider,
      providerConversationId: identity.providerConversationId,
      createdAt: toArchiveDate(meta.created_at || options.createdAt),
      updatedAt: toArchiveDate(meta.updated_at || options.updatedAt),
      favorite: Boolean(options.favorite ?? meta.is_starred)
    }),
    branches: buildBranches(messages),
    messages
  };
}

const selectProjectInfo = (meta, exportContext = {}) => {
  const projectInfo = exportContext.projectInfo;

  if (Array.isArray(projectInfo)) {
    return projectInfo.find(project => {
      const id = project.uuid || project.id;
      return id && id === meta.project_uuid;
    }) || null;
  }

  return projectInfo || meta.project || null;
};

const normalizeKnowledgeFiles = (files = []) => {
  if (!Array.isArray(files)) return [];

  return files.map((file, index) => compactRecord({
    id: file.id || file.uuid || buildStableArchiveId('kf', [file.name, index]),
    name: file.name || file.file_name || `Knowledge file ${index + 1}`,
    summary: file.summary || file.description || file.excerpt,
    size: file.size || file.file_size,
    mimeType: file.mimeType || file.mime_type || file.file_type
  }));
};

const normalizeMemoryEntries = (value, defaultTitle) => {
  if (!value) return [];

  const entries = Array.isArray(value) ? value : [value];

  return entries
    .map((entry, index) => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        return compactRecord({
          id: buildStableArchiveId('memory', [defaultTitle, entry, index]),
          title: defaultTitle,
          content: entry
        });
      }

      return compactRecord({
        id: entry.id || entry.uuid || buildStableArchiveId('memory', [
          defaultTitle,
          entry.title || entry.name,
          entry.content || entry.memory || entry.text,
          index
        ]),
        title: entry.title || entry.name || defaultTitle,
        content: entry.content || entry.memory || entry.text || entry.value || safeStringify(entry)
      });
    })
    .filter(Boolean);
};

export function buildContextArchive(processedData, exportContext = {}, options = {}) {
  if (!processedData || typeof processedData !== 'object') {
    throw new Error('Processed conversation data must be an object.');
  }

  const meta = processedData.meta_info || {};
  const identity = getConversationIdentity(processedData, options);
  const projectInfo = selectProjectInfo(meta, exportContext);
  const project = projectInfo ? compactRecord({
    id: projectInfo.uuid || projectInfo.id || meta.project_uuid,
    name: projectInfo.name,
    description: projectInfo.description,
    instructions: projectInfo.instructions,
    knowledgeFiles: normalizeKnowledgeFiles(projectInfo.knowledgeFiles)
  }) : null;
  const userMemory = exportContext.userMemory || {};

  return {
    schemaVersion: CONTEXT_SCHEMA_VERSION,
    conversationId: identity.conversationId,
    project: project || undefined,
    memories: {
      global: normalizeMemoryEntries(userMemory.memories || userMemory.memory || exportContext.global_memory, 'Global memory'),
      project: normalizeMemoryEntries(projectInfo?.memory || exportContext.projectMemory, 'Project memory'),
      saved: normalizeMemoryEntries(userMemory.saved || exportContext.savedMemories, 'Saved memory')
    }
  };
}

const entriesFromCollection = (collection) => {
  if (!collection) return [];
  if (collection instanceof Set) return Array.from(collection);
  if (collection instanceof Map) {
    return Array.from(collection.entries())
      .filter(([, isEnabled]) => isEnabled)
      .map(([key]) => key);
  }
  if (Array.isArray(collection)) return collection;
  if (typeof collection === 'object') {
    return Object.entries(collection)
      .filter(([, isEnabled]) => isEnabled)
      .map(([key]) => key);
  }
  return [collection];
};

const normalizeFavoriteIds = (favorites, conversationId, favorite) => {
  const ids = entriesFromCollection(favorites).map(item => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') return item.id || item.uuid || item.conversationId;
    return null;
  }).filter(Boolean);

  if (favorite && !ids.includes(conversationId)) {
    ids.push(conversationId);
  }

  return ids;
};

const buildMessageIndexMap = (messages) => {
  const byIndex = new Map();

  messages.forEach((message, index) => {
    byIndex.set(index, message.id);
    if (Number.isInteger(message.metadata?.sourceIndex)) {
      byIndex.set(message.metadata.sourceIndex, message.id);
      byIndex.set(String(message.metadata.sourceIndex), message.id);
    }
  });

  return byIndex;
};

const normalizeMessageTagTarget = (target, byIndex) => {
  if (target === undefined || target === null || target === '') return null;
  if (byIndex.has(target)) return byIndex.get(target);

  const numericTarget = Number(target);
  if (Number.isInteger(numericTarget) && byIndex.has(numericTarget)) {
    return byIndex.get(numericTarget);
  }

  return String(target);
};

const normalizeExtraTag = (tag, conversationId, createdAt, source) => {
  if (typeof tag === 'string') {
    return {
      tag,
      conversationId,
      createdAt,
      source
    };
  }

  return compactRecord({
    tag: tag.tag || tag.name,
    conversationId: tag.conversationId || conversationId,
    messageId: tag.messageId,
    createdAt: toArchiveDate(tag.createdAt) || createdAt,
    source: tag.source || source
  });
};

export function buildAnnotationsArchive(options = {}) {
  const conversationId = options.conversationId;
  const createdAt = toArchiveDate(options.createdAt || new Date()) || new Date().toISOString();
  const source = options.source || 'loominary';
  const messages = options.messages || [];
  const byIndex = buildMessageIndexMap(messages);
  const tags = [];

  MARK_TYPES.forEach(markType => {
    entriesFromCollection(options.marks?.[markType]).forEach(target => {
      const messageId = normalizeMessageTagTarget(target, byIndex);
      tags.push(compactRecord({
        tag: markType,
        conversationId,
        messageId,
        createdAt,
        source
      }));
    });
  });

  entriesFromCollection(options.tags).forEach(tag => {
    const normalized = normalizeExtraTag(tag, conversationId, createdAt, source);
    if (normalized.tag) tags.push(normalized);
  });

  return {
    schemaVersion: ANNOTATIONS_SCHEMA_VERSION,
    favorites: normalizeFavoriteIds(options.favorites, conversationId, options.favorite),
    tags
  };
}

export function buildArchiveBundle(processedData, options = {}) {
  const conversation = buildConversationArchive(processedData, options);
  const conversationId = conversation.conversation.id;
  const context = buildContextArchive(processedData, options.exportContext || {}, {
    ...options,
    conversationId
  });
  const annotations = buildAnnotationsArchive({
    ...options,
    conversationId,
    favorite: conversation.conversation.favorite,
    messages: conversation.messages
  });

  return {
    manifest: buildArchiveManifest(options),
    conversation,
    context,
    annotations
  };
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Archive manifest must be an object.');
  }

  if (manifest.schemaVersion !== ARCHIVE_SCHEMA_VERSION) {
    throw new Error(`Unsupported archive schema version: ${manifest.schemaVersion || 'missing'}`);
  }

  if (!manifest.archiveId || typeof manifest.archiveId !== 'string') {
    throw new Error('Archive manifest is missing archiveId.');
  }

  if (!manifest.layout || typeof manifest.layout !== 'object') {
    throw new Error('Archive manifest is missing layout.');
  }

  return manifest;
}

export function validateConversationRecord(record) {
  if (!record || typeof record !== 'object') {
    throw new Error('Conversation record must be an object.');
  }

  if (record.schemaVersion !== CONVERSATION_SCHEMA_VERSION) {
    throw new Error(`Unsupported conversation schema version: ${record.schemaVersion || 'missing'}`);
  }

  if (!record.conversation?.id) {
    throw new Error('Conversation record is missing conversation.id.');
  }

  if (!Array.isArray(record.messages)) {
    throw new Error(`Conversation ${record.conversation.id} is missing messages.`);
  }

  if (!Array.isArray(record.branches)) {
    throw new Error(`Conversation ${record.conversation.id} is missing branches.`);
  }

  return record;
}

export function validateContextRecord(record) {
  if (!record || typeof record !== 'object') {
    throw new Error('Context record must be an object.');
  }

  if (record.schemaVersion !== CONTEXT_SCHEMA_VERSION) {
    throw new Error(`Unsupported context schema version: ${record.schemaVersion || 'missing'}`);
  }

  if (!record.conversationId || typeof record.conversationId !== 'string') {
    throw new Error('Context record is missing conversationId.');
  }

  return record;
}

export function validateAnnotations(record) {
  if (!record || typeof record !== 'object') {
    throw new Error('Annotations record must be an object.');
  }

  if (record.schemaVersion !== ANNOTATIONS_SCHEMA_VERSION) {
    throw new Error(`Unsupported annotations schema version: ${record.schemaVersion || 'missing'}`);
  }

  if (!Array.isArray(record.favorites)) {
    throw new Error('Annotations record is missing favorites.');
  }

  if (!Array.isArray(record.tags)) {
    throw new Error('Annotations record is missing tags.');
  }

  return record;
}
