// src/utils/data/annotationManager.js
// Durable annotation store for archive-first annotations and favorites

import StorageManager from './storageManager';
import { ANNOTATION_KEYS, normalizeId } from '../archive/archiveContract.js';

export class AnnotationManager {
  constructor(fileUuid) {
    this.fileUuid = normalizeId(fileUuid);
    this.annotations = this.fileUuid ? StorageManager.getAnnotations(this.fileUuid) : AnnotationManager.defaultAnnotations();
  }

  static defaultAnnotations() {
    return {
      version: 'loominaryAnnotations/v1',
      conversationFavorites: {},
      messageTags: {},
      names: {}
    };
  }

  save() {
    if (!this.fileUuid) return;
    StorageManager.setAnnotations(this.fileUuid, this.annotations);
  }

  getConversationFavorite(conversationUuid) {
    const favorites = this.annotations.conversationFavorites || {};
    return !!favorites[conversationUuid];
  }

  setConversationFavorite(conversationUuid, favorite) {
    const favorites = { ...(this.annotations.conversationFavorites || {}) };
    favorites[conversationUuid] = !!favorite;
    this.annotations.conversationFavorites = favorites;
    this.save();
  }

  getMessageTags(conversationUuid, messageUuid) {
    const messageTags = this.annotations.messageTags || {};
    const conversationTags = messageTags[conversationUuid] || {};
    return Object.entries(conversationTags)
      .filter(([, ids]) => Array.isArray(ids) && ids.includes(messageUuid))
      .map(([tag]) => tag);
  }

  addMessageTag(conversationUuid, messageUuid, tag) {
    const messageTags = { ...(this.annotations.messageTags || {}) };
    const conversationTags = { ...(messageTags[conversationUuid] || {}) };
    const tagList = Array.isArray(conversationTags[tag]) ? [...conversationTags[tag]] : [];
    if (!tagList.includes(messageUuid)) tagList.push(messageUuid);
    conversationTags[tag] = tagList;
    messageTags[conversationUuid] = conversationTags;
    this.annotations.messageTags = messageTags;
    this.save();
  }

  removeMessageTag(conversationUuid, messageUuid, tag) {
    const messageTags = { ...(this.annotations.messageTags || {}) };
    const conversationTags = { ...(messageTags[conversationUuid] || {}) };
    const tagList = Array.isArray(conversationTags[tag])
      ? conversationTags[tag].filter(id => id !== messageUuid)
      : [];
    if (tagList.length === 0) delete conversationTags[tag];
    else conversationTags[tag] = tagList;
    messageTags[conversationUuid] = conversationTags;
    this.annotations.messageTags = messageTags;
    this.save();
  }

  getConversationName(conversationUuid) {
    const names = this.annotations.names || {};
    return names[conversationUuid] || null;
  }

  setConversationName(conversationUuid, name) {
    const names = { ...(this.annotations.names || {}) };
    if (!name) delete names[conversationUuid];
    else names[conversationUuid] = name;
    this.annotations.names = names;
    this.save();
  }

  getAnnotations() {
    return JSON.parse(JSON.stringify(this.annotations));
  }

  importAnnotations(annotations) {
    if (!annotations || typeof annotations !== 'object') return;
    this.annotations = {
      version: annotations.version || 'loominaryAnnotations/v1',
      conversationFavorites: annotations.conversationFavorites || {},
      messageTags: annotations.messageTags || {},
      names: annotations.names || {}
    };
    this.save();
  }

  clear() {
    this.annotations = AnnotationManager.defaultAnnotations();
    this.save();
  }
}

export const getFileAnnotations = (fileUuid) => {
  const manager = new AnnotationManager(fileUuid);
  return manager.getAnnotations();
};
