// src/utils/archive/archiveWriter.js
// Maps parsed conversation data and auxiliary state into loominary.archive/v1

import { DEFAULT_ARCHIVE, ROOT_KEYS, CONVERSATION_KEYS, MESSAGE_KEYS, BRANCH_KEYS, CONTEXT_KEYS, ANNOTATION_KEYS, METADATA_KEYS, normalizeId, contractAssert } from './archiveContract.js';

export class ArchiveWriter {
  static toArchive({ parsedData, exportContext = null, annotations = null, source = 'local' } = {}) {
    const archive = DEFAULT_ARCHIVE();
    archive[ROOT_KEYS.EXPORTED_BY] = source;

    const conversations = [];
    const metadata = archive[ROOT_KEYS.METADATA];
    const providerSet = new Set();

    if (parsedData?.chat_history?.length) {
      const conversation = ArchiveWriter.mapConversation(parsedData);
      conversations.push(conversation);
      if (conversation.platform) providerSet.add(conversation.platform);
    }

    if (exportContext) {
      archive[ROOT_KEYS.CONTEXT] = ArchiveWriter.mapContext(exportContext);
    }

    if (annotations) {
      archive[ROOT_KEYS.ANNOTATIONS] = ArchiveWriter.mapAnnotations(annotations);
    } else {
      archive[ROOT_KEYS.ANNOTATIONS] = ArchiveWriter.defaultAnnotations();
    }

    archive[ROOT_KEYS.CONVERSATIONS] = conversations;
    metadata[METADATA_KEYS.TOTAL_CONVERSATIONS] = conversations.length;
    metadata[METADATA_KEYS.TOTAL_MESSAGES] = conversations.reduce((sum, c) => sum + (c.messages?.length || 0), 0);
    metadata[METADATA_KEYS.PROVIDERS] = Array.from(providerSet);

    contractAssert(archive);
    return archive;
  }

  static mapConversation(parsedData) {
    const meta = parsedData.meta_info || {};
    const conversation = {
      [CONVERSATION_KEYS.ID]: normalizeId(meta.uuid),
      [CONVERSATION_KEYS.PLATFORM]: meta.platform || parsedData.format || 'unknown',
      [CONVERSATION_KEYS.PROVIDER]: ArchiveWriter.inferProvider(parsedData.format || meta.platform),
      [CONVERSATION_KEYS.TITLE]: meta.title || '',
      [CONVERSATION_KEYS.CREATED_AT]: meta.created_at || null,
      [CONVERSATION_KEYS.UPDATED_AT]: meta.updated_at || null,
      [CONVERSATION_KEYS.MODEL]: meta.model || '',
      [CONVERSATION_KEYS.UUID]: normalizeId(meta.uuid),
      [CONVERSATION_KEYS.RAW_URI]: null,
      [CONVERSATION_KEYS.PROJECT]: meta.project || null,
      [CONVERSATION_KEYS.ORGANIZATION_ID]: meta.organization_id || null,
      [CONVERSATION_KEYS.MESSAGE_COUNT]: parsedData.chat_history?.length || 0,
      [CONVERSATION_KEYS.MESSAGES]: [],
      [CONVERSATION_KEYS.BRANCHES]: []
    };

    const messageIdByUuid = new Map();
    const branchPointByParentUuid = new Map();

    (parsedData.chat_history || []).forEach((msg, index) => {
      const message = ArchiveWriter.mapMessage(msg, index);
      if (message.id) messageIdByUuid.set(message.uuid, message.id);
      conversation.messages.push(message);

      if (message.isBranchPoint && message.parentId) {
        if (!branchPointByParentUuid.has(message.parentId)) {
          branchPointByParentUuid.set(message.parentId, []);
        }
        branchPointByParentUuid.get(message.parentId).push(message);
      }
    });

    branchPointByParentUuid.forEach((branchMessages, parentUuid) => {
      const branchId = `branch_${parentUuid || 'root'}`;
      const pointMessageId = messageIdByUuid.get(parentUuid) || null;
      const branch = {
        [BRANCH_KEYS.ID]: normalizeId(branchId),
        [BRANCH_KEYS.POINT_MESSAGE_ID]: pointMessageId,
        [BRANCH_KEYS.LABEL]: null,
        [BRANCH_KEYS.INDEX]: 0,
        [BRANCH_KEYS.MESSAGE_IDS]: branchMessages.map(m => m.id).filter(Boolean),
        [BRANCH_KEYS.CREATED_AT]: branchMessages[0]?.timestamp || null
      };
      conversation.branches.push(branch);

      branchMessages.forEach((m, idx) => {
        m.branchId = branch[BRANCH_KEYS.ID];
      });
    });

    return conversation;
  }

  static mapMessage(msg, index) {
    return {
      [MESSAGE_KEYS.ID]: normalizeId(msg.uuid) || `msg_${index}`,
      [MESSAGE_KEYS.UUID]: normalizeId(msg.uuid) || `msg_${index}`,
      [MESSAGE_KEYS.PARENT_ID]: normalizeId(msg.parent_uuid) || null,
      [MESSAGE_KEYS.BRANCH_ID]: normalizeId(msg.branch_id),
      [MESSAGE_KEYS.ROLE]: msg.sender === 'human' ? 'user' : 'assistant',
      [MESSAGE_KEYS.TIMESTAMP]: msg.timestamp || msg.created_at || null,
      [MESSAGE_KEYS.CREATED_AT]: msg.created_at || msg.timestamp || null,
      [MESSAGE_KEYS.CONTENT]: ArchiveWriter.extractTextContent(msg),
      [MESSAGE_KEYS.RAW_TEXT]: msg.raw_text || '',
      [MESSAGE_KEYS.THINKING]: msg.thinking || '',
      [MESSAGE_KEYS.ARTIFACTS]: Array.isArray(msg.artifacts) ? msg.artifacts : [],
      [MESSAGE_KEYS.TOOLS]: Array.isArray(msg.tools) ? msg.tools : [],
      [MESSAGE_KEYS.CITATIONS]: Array.isArray(msg.citations) ? msg.citations : [],
      [MESSAGE_KEYS.IMAGES]: Array.isArray(msg.images) ? msg.images : [],
      [MESSAGE_KEYS.ATTACHMENTS]: Array.isArray(msg.attachments) ? msg.attachments : [],
      [MESSAGE_KEYS.IS_BRANCH_POINT]: !!msg.is_branch_point,
      [MESSAGE_KEYS.BRANCH_LEVEL]: typeof msg.branch_level === 'number' ? msg.branch_level : 0,
      [MESSAGE_KEYS.STOP_REASON]: msg.stop_reason || null,
      [MESSAGE_KEYS.INPUT_MODE]: msg.input_mode || null,
      [MESSAGE_KEYS.TAGS]: [],
      [MESSAGE_KEYS.FAVORITE]: false
    };
  }

  static extractTextContent(msg) {
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content
        .filter(item => item && item.type === 'text' && typeof item.text === 'string')
        .map(item => item.text)
        .join('\n');
    }
    if (typeof msg.display_text === 'string') return msg.display_text;
    if (typeof msg.text === 'string') return msg.text;
    return '';
  }

  static inferProvider(format) {
    const map = {
      claude: 'claude',
      claude_code: 'claude',
      chatgpt: 'chatgpt',
      grok: 'grok',
      copilot: 'copilot',
      gemini_notebooklm: 'gemini',
      jsonl_chat: 'sillytavern'
    };
    return map[format] || format || 'unknown';
  }

  static mapContext(exportContext = {}) {
    const context = {};
    context[CONTEXT_KEYS.VERSION] = 'loominaryContext/v1';

    if (exportContext.projectInfo) {
      context[CONTEXT_KEYS.PROJECTS] = Array.isArray(exportContext.projectInfo)
        ? exportContext.projectInfo.map(project => ({
            uuid: normalizeId(project.uuid),
            name: project.name || '',
            description: project.description || '',
            instructions: project.instructions || '',
            memory: project.memory || '',
            memoryUpdatedAt: project.memory_updated_at || null,
            archived: !!project.archived,
            knowledgeFiles: Array.isArray(project.knowledge_files) ? project.knowledge_files : []
          }))
        : [];
    }

    if (exportContext.userMemory) {
      context[CONTEXT_KEYS.MEMORIES] = {
        preferences: exportContext.userMemory.preferences || '',
        memories: exportContext.userMemory.memories || ''
      };
    }

    return context;
  }

  static defaultAnnotations() {
    return {
      [ANNOTATION_KEYS.VERSION]: 'loominaryAnnotations/v1',
      [ANNOTATION_KEYS.CONVERSATION_FAVORITES]: {},
      [ANNOTATION_KEYS.MESSAGE_TAGS]: {},
      [ANNOTATION_KEYS.NAMES]: {}
    };
  }

  static mapAnnotations({ marks = null, starManager = null, renameManager = null, conversationUuid = null } = {}) {
    const annotations = ArchiveWriter.defaultAnnotations();

    if (marks && conversationUuid) {
      annotations[ANNOTATION_KEYS.MESSAGE_TAGS][conversationUuid] = {
        completed: Array.from(marks.completed || []),
        important: Array.from(marks.important || []),
        deleted: Array.from(marks.deleted || [])
      };
    }

    if (starManager && conversationUuid) {
      const nativeStarred = typeof starManager.isStarred === 'function'
        ? starManager.isStarred(conversationUuid, false)
        : false;
      annotations[ANNOTATION_KEYS.CONVERSATION_FAVORITES][conversationUuid] = !!nativeStarred;
    }

    if (renameManager && conversationUuid) {
      const customName = typeof renameManager.getRename === 'function'
        ? renameManager.getRename(conversationUuid, null)
        : null;
      if (customName) {
        annotations[ANNOTATION_KEYS.NAMES][conversationUuid] = customName;
      }
    }

    return annotations;
  }

  static mergeAnnotations(base = {}, incoming = {}) {
    const merged = { ...base };
    const baseFavorites = base.conversationFavorites || {};
    const incomingFavorites = incoming.conversationFavorites || {};
    merged.conversationFavorites = { ...baseFavorites, ...incomingFavorites };

    const baseTags = base.messageTags || {};
    const incomingTags = incoming.messageTags || {};
    merged.messageTags = { ...baseTags, ...incomingTags };

    const baseNames = base.names || {};
    const incomingNames = incoming.names || {};
    merged.names = { ...baseNames, ...incomingNames };

    merged.version = 'loominaryAnnotations/v1';
    return merged;
  }
}
