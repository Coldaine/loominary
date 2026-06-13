// src/utils/archive/archiveService.js
// Local archive service: serves archive records for consumers and search

import { DEFAULT_ARCHIVE, ROOT_KEYS, CONVERSATION_KEYS, MESSAGE_KEYS, CONTEXT_KEYS, ANNOTATION_KEYS, METADATA_KEYS, contractAssert, ARCHIVE_VERSION } from './archiveContract.js';
import { ArchiveWriter } from './archiveWriter.js';

export class ArchiveService {
  constructor() {
    this.archive = DEFAULT_ARCHIVE();
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    this.listeners.forEach(listener => {
      try { listener(this.archive); } catch (e) { /* ignore subscriber errors */ }
    });
  }

  loadArchive(json) {
    let parsed;
    try {
      parsed = typeof json === 'string' ? JSON.parse(json) : json;
    } catch (e) {
      throw new Error('[archiveService] invalid archive JSON');
    }
    contractAssert(parsed);
    this.archive = parsed;
    this.emit();
    return this.archive;
  }

  importParsedData({ parsedData, exportContext = null, annotations = null, source = 'local' } = {}) {
    const archive = ArchiveWriter.toArchive({ parsedData, exportContext, annotations, source });
    this.archive = archive;
    this.emit();
    return archive;
  }

  getConversation(conversationId) {
    return this.archive[ROOT_KEYS.CONVERSATIONS].find(c => c[CONVERSATION_KEYS.ID] === conversationId) || null;
  }

  getConversationByUuid(uuid) {
    return this.archive[ROOT_KEYS.CONVERSATIONS].find(c => c[CONVERSATION_KEYS.UUID] === uuid) || null;
  }

  getConversations() {
    return this.archive[ROOT_KEYS.CONVERSATIONS] || [];
  }

  getMessage(conversationId, messageId) {
    const conversation = this.getConversation(conversationId);
    if (!conversation) return null;
    return (conversation[MESSAGE_KEYS.MESSAGES] || []).find(m => m[MESSAGE_KEYS.ID] === messageId) || null;
  }

  getMessageByUuid(messageUuid) {
    for (const conversation of this.archive[ROOT_KEYS.CONVERSATIONS]) {
      const message = (conversation[MESSAGE_KEYS.MESSAGES] || []).find(m => m[MESSAGE_KEYS.UUID] === messageUuid);
      if (message) return message;
    }
    return null;
  }

  search(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return { results: [], stats: { conversations: 0, messages: 0 } };

    const conversationSet = new Set();
    const results = [];

    for (const conversation of this.archive[ROOT_KEYS.CONVERSATIONS]) {
      let matched = false;
      const messages = conversation[MESSAGE_KEYS.MESSAGES] || [];

      for (const message of messages) {
        const haystack = [message[MESSAGE_KEYS.CONTENT], message[MESSAGE_KEYS.THINKING], message[MESSAGE_KEYS.RAW_TEXT]]
          .filter(Boolean)
          .join('\n')
          .toLowerCase();

        if (haystack.includes(q)) {
          matched = true;
          results.push({
            conversationId: conversation[CONVERSATION_KEYS.ID],
            conversationUuid: conversation[CONVERSATION_KEYS.UUID],
            conversationTitle: conversation[CONVERSATION_KEYS.TITLE],
            messageId: message[MESSAGE_KEYS.ID],
            messageUuid: message[MESSAGE_KEYS.UUID],
            preview: (message[MESSAGE_KEYS.CONTENT] || '').slice(0, 200),
            timestamp: message[MESSAGE_KEYS.TIMESTAMP] || message[MESSAGE_KEYS.CREATED_AT]
          });
        }
      }

      if (matched) conversationSet.add(conversation[CONVERSATION_KEYS.ID]);
    }

    return {
      results,
      stats: {
        conversations: conversationSet.size,
        messages: results.length
      }
    };
  }

  getContext() {
    return this.archive[ROOT_KEYS.CONTEXT] || {};
  }

  updateContext(contextPatch) {
    this.archive[ROOT_KEYS.CONTEXT] = { ...(this.archive[ROOT_KEYS.CONTEXT] || {}), ...contextPatch };
    this.emit();
    return this.archive[ROOT_KEYS.CONTEXT];
  }

  getAnnotations() {
    return this.archive[ROOT_KEYS.ANNOTATIONS] || {};
  }

  updateAnnotations(annotationsPatch) {
    this.archive[ROOT_KEYS.ANNOTATIONS] = { ...(this.archive[ROOT_KEYS.ANNOTATIONS] || {}), ...annotationsPatch };
    this.emit();
    return this.archive[ROOT_KEYS.ANNOTATIONS];
  }

  setConversationFavorite(conversationId, favorite) {
    const annotations = this.getAnnotations();
    const favorites = annotations[ANNOTATION_KEYS.CONVERSATION_FAVORITES] || {};
    favorites[conversationId] = !!favorite;
    return this.updateAnnotations({ [ANNOTATION_KEYS.CONVERSATION_FAVORITES]: favorites });
  }

  setMessageTag(conversationId, messageId, tag) {
    const annotations = this.getAnnotations();
    const messageTags = annotations[ANNOTATION_KEYS.MESSAGE_TAGS] || {};
    const conversationTags = messageTags[conversationId] || {};
    const tagList = Array.isArray(conversationTags[tag]) ? [...conversationTags[tag]] : [];
    if (!tagList.includes(messageId)) tagList.push(messageId);
    conversationTags[tag] = tagList;
    messageTags[conversationId] = conversationTags;
    return this.updateAnnotations({ [ANNOTATION_KEYS.MESSAGE_TAGS]: messageTags });
  }

  removeMessageTag(conversationId, messageId, tag) {
    const annotations = this.getAnnotations();
    const messageTags = annotations[ANNOTATION_KEYS.MESSAGE_TAGS] || {};
    const conversationTags = messageTags[conversationId] || {};
    const tagList = Array.isArray(conversationTags[tag]) ? conversationTags[tag].filter(id => id !== messageId) : [];
    if (tagList.length === 0) {
      delete conversationTags[tag];
    } else {
      conversationTags[tag] = tagList;
    }
    messageTags[conversationId] = conversationTags;
    return this.updateAnnotations({ [ANNOTATION_KEYS.MESSAGE_TAGS]: messageTags });
  }

  setConversationName(conversationId, name) {
    const annotations = this.getAnnotations();
    const names = annotations[ANNOTATION_KEYS.NAMES] || {};
    if (!name) delete names[conversationId];
    else names[conversationId] = name;
    return this.updateAnnotations({ [ANNOTATION_KEYS.NAMES]: names });
  }

  getBranchTree(conversationId) {
    const conversation = this.getConversation(conversationId);
    if (!conversation) return [];
    return conversation[CONVERSATION_KEYS.BRANCHES] || [];
  }

  getConversationMessages(conversationId) {
    const conversation = this.getConversation(conversationId);
    return conversation?.[MESSAGE_KEYS.MESSAGES] || [];
  }

  getBranchMessages(conversationId, branchId) {
    const branch = this.getBranchTree(conversationId).find(b => b.id === branchId);
    if (!branch) return [];
    const messages = this.getConversationMessages(conversationId);
    return branch.messageIds
      .map(id => messages.find(m => m[MESSAGE_KEYS.ID] === id))
      .filter(Boolean);
  }

  toJSON() {
    return JSON.parse(JSON.stringify(this.archive));
  }

  getMetadata() {
    return this.archive[ROOT_KEYS.METADATA] || {};
  }

  exportArchiveJSON() {
    return JSON.stringify(this.toJSON(), null, 2);
  }

  exportConversationArchive(conversationId) {
    const conversation = this.getConversation(conversationId);
    if (!conversation) return null;
    const subset = {
      [ROOT_KEYS.VERSION]: ARCHIVE_VERSION,
      [ROOT_KEYS.EXPORTED_AT]: new Date().toISOString(),
      [ROOT_KEYS.EXPORTED_BY]: 'loominary',
      [ROOT_KEYS.CONVERSATIONS]: [conversation],
      [ROOT_KEYS.CONTEXT]: this.getContext(),
      [ROOT_KEYS.ANNOTATIONS]: this.getAnnotations(),
      [ROOT_KEYS.METADATA]: {
        [METADATA_KEYS.TOTAL_CONVERSATIONS]: 1,
        [METADATA_KEYS.TOTAL_MESSAGES]: conversation[MESSAGE_KEYS.MESSAGES]?.length || 0,
        [METADATA_KEYS.PROVIDERS]: [conversation[CONVERSATION_KEYS.PROVIDER]],
        [METADATA_KEYS.SOURCE_FILES]: [],
        [METADATA_KEYS.GENERATED_BY]: 'loominary'
      }
    };
    contractAssert(subset);
    return JSON.stringify(subset, null, 2);
  }
}

let archiveServiceInstance = null;

export function getArchiveService() {
  if (!archiveServiceInstance) {
    archiveServiceInstance = new ArchiveService();
  }
  return archiveServiceInstance;
}

export function resetArchiveService() {
  archiveServiceInstance = null;
}
