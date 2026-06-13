// src/utils/archive/archiveContract.js
// Archive v1 contract: shape, defaults, immutability, extension surface

export const ARCHIVE_VERSION = 'loominary.archive/v1';

export const ROOT_KEYS = {
  VERSION: 'loominaryVersion',
  EXPORTED_AT: 'exportedAt',
  EXPORTED_BY: 'exportedBy',
  CONVERSATIONS: 'conversations',
  CONTEXT: 'context',
  ANNOTATIONS: 'annotations',
  METADATA: 'metadata'
};

export const CONVERSATION_KEYS = {
  ID: 'id',
  PLATFORM: 'platform',
  PROVIDER: 'provider',
  TITLE: 'title',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  MODEL: 'model',
  UUID: 'uuid',
  RAW_URI: 'rawUri',
  PROJECT: 'project',
  ORGANIZATION_ID: 'organizationId',
  MESSAGE_COUNT: 'messageCount',
  MESSAGES: 'messages',
  BRANCHES: 'branches'
};

export const MESSAGE_KEYS = {
  ID: 'id',
  UUID: 'uuid',
  PARENT_ID: 'parentId',
  BRANCH_ID: 'branchId',
  ROLE: 'role',
  TIMESTAMP: 'timestamp',
  CREATED_AT: 'createdAt',
  CONTENT: 'content',
  RAW_TEXT: 'rawText',
  THINKING: 'thinking',
  ARTIFACTS: 'artifacts',
  TOOLS: 'tools',
  CITATIONS: 'citations',
  IMAGES: 'images',
  ATTACHMENTS: 'attachments',
  IS_BRANCH_POINT: 'isBranchPoint',
  BRANCH_LEVEL: 'branchLevel',
  STOP_REASON: 'stopReason',
  INPUT_MODE: 'inputMode',
  TAGS: 'tags',
  FAVORITE: 'favorite'
};

export const BRANCH_KEYS = {
  ID: 'id',
  POINT_MESSAGE_ID: 'pointMessageId',
  LABEL: 'label',
  INDEX: 'index',
  MESSAGE_IDS: 'messageIds',
  CREATED_AT: 'createdAt'
};

export const CONTEXT_KEYS = {
  VERSION: 'loominaryContextVersion',
  TYPE: 'type',
  PLATFORM: 'platform',
  ACCOUNT: 'account',
  PROJECTS: 'projects',
  MEMORIES: 'memories',
  KNOWLEDGE_FILES: 'knowledgeFiles',
  CHARACTER: 'character',
  WORLD_BOOK: 'worldBook',
  PRESET: 'preset',
  RAW_URI: 'rawUri'
};

export const ANNOTATION_KEYS = {
  VERSION: 'loominaryAnnotationsVersion',
  CONVERSATION_FAVORITES: 'conversationFavorites',
  MESSAGE_TAGS: 'messageTags',
  NAMES: 'names'
};

export const METADATA_KEYS = {
  TOTAL_CONVERSATIONS: 'totalConversations',
  TOTAL_MESSAGES: 'totalMessages',
  PROVIDERS: 'providers',
  SOURCE_FILES: 'sourceFiles',
  GENERATED_BY: 'generatedBy',
  NOTES: 'notes'
};

export const DEFAULT_ARCHIVE = () => ({
  [ROOT_KEYS.VERSION]: ARCHIVE_VERSION,
  [ROOT_KEYS.EXPORTED_AT]: new Date().toISOString(),
  [ROOT_KEYS.EXPORTED_BY]: 'loominary',
  [ROOT_KEYS.CONVERSATIONS]: [],
  [ROOT_KEYS.CONTEXT]: {},
  [ROOT_KEYS.ANNOTATIONS]: {},
  [ROOT_KEYS.METADATA]: {
    [METADATA_KEYS.TOTAL_CONVERSATIONS]: 0,
    [METADATA_KEYS.TOTAL_MESSAGES]: 0,
    [METADATA_KEYS.PROVIDERS]: [],
    [METADATA_KEYS.SOURCE_FILES]: [],
    [METADATA_KEYS.GENERATED_BY]: 'loominary'
  }
});

export const normalizeId = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
};

export const isValidBranchId = (value) => /^branch_[A-Za-z0-9_-]+$/.test(String(value || ''));

export const contractAssert = (archive) => {
  if (!archive || typeof archive !== 'object') {
    throw new Error('[archiveContract] archive must be an object');
  }
  if (archive[ROOT_KEYS.VERSION] !== ARCHIVE_VERSION) {
    throw new Error(`[archiveContract] unsupported archive version: ${archive[ROOT_KEYS.VERSION]}`);
  }
  if (!Array.isArray(archive[ROOT_KEYS.CONVERSATIONS])) {
    throw new Error('[archiveContract] conversations must be an array');
  }
  const ann = archive[ROOT_KEYS.ANNOTATIONS] || {};
  if (ann.version && ann.version !== 'loominaryAnnotations/v1') {
    throw new Error(`[archiveContract] unsupported annotations version: ${ann.version}`);
  }
};
