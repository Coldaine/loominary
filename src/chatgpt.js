const ChatGPTHandler = {
    init: () => {},

    getCurrentConversationId: () => {
        const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
        return match ? match[1] : null;
    },

    getConversationTitle: () => {
        const titleCandidates = [
            document.querySelector('main h1'),
            document.querySelector('[data-testid="conversation-title"]'),
            document.querySelector('title')
        ];
        for (const element of titleCandidates) {
            const text = LoominaryDomCapture.normalizeText(element?.innerText || element?.textContent);
            if (text && !/^chatgpt$/i.test(text)) return text.replace(/\s*[-|]\s*ChatGPT.*$/i, '');
        }
        const activeSidebar = document.querySelector('a[href="' + window.location.pathname + '"], a[href="' + window.location.href + '"]');
        return LoominaryDomCapture.normalizeText(activeSidebar?.innerText || activeSidebar?.textContent) || 'ChatGPT conversation';
    },

    discoverVisibleConversations: () => {
        const byId = new Map();
        document.querySelectorAll('a[href*="/c/"]').forEach(anchor => {
            if (!LoominaryDomCapture.isVisible(anchor)) return;
            const href = LoominaryDomCapture.absoluteUrl(anchor.getAttribute('href'));
            const match = href.match(/\/c\/([a-zA-Z0-9-]+)/);
            if (!match) return;
            const id = match[1];
            if (byId.has(id)) return;
            byId.set(id, {
                id,
                url: href,
                title: LoominaryDomCapture.normalizeText(anchor.innerText || anchor.textContent) || id
            });
        });
        return Array.from(byId.values());
    },

    getMessageGroups: () => {
        const groups = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'))
            .filter(LoominaryDomCapture.isVisible);
        if (groups.length > 0) return groups;

        const roleNodes = Array.from(document.querySelectorAll('[data-message-author-role]'))
            .filter(LoominaryDomCapture.isVisible);
        return roleNodes.map(node => node.closest('article') || node.closest('[data-testid]') || node);
    },

    extractRole: (group) => {
        const roleNode = group.querySelector('[data-message-author-role]') || group.closest('[data-message-author-role]');
        const role = roleNode?.getAttribute('data-message-author-role');
        if (role === 'user') return 'user';
        if (role === 'assistant') return 'assistant';

        const text = LoominaryDomCapture.normalizeText(group.getAttribute('aria-label') || group.className || '');
        if (/user|you|human/i.test(text)) return 'user';
        return 'assistant';
    },

    extractMessage: (group, index) => {
        const role = ChatGPTHandler.extractRole(group);
        const contentRoot = group.querySelector('[data-message-author-role="' + role + '"]') ||
            group.querySelector('.markdown, [class*="markdown"], [data-message-id]') ||
            group;
        const text = LoominaryDomCapture.elementText(contentRoot);
        const messageId = group.querySelector('[data-message-id]')?.getAttribute('data-message-id') ||
            contentRoot.getAttribute('data-message-id') ||
            group.getAttribute('data-message-id') ||
            null;

        return {
            id: messageId,
            role,
            senderLabel: role === 'user' ? 'User' : 'ChatGPT',
            text,
            images: LoominaryDomCapture.extractImages(group, State.includeImages),
            attachments: LoominaryDomCapture.extractAttachments(group),
            links: LoominaryDomCapture.extractLinks(contentRoot),
            branchEvidence: LoominaryDomCapture.extractBranchEvidence(group),
            domPath: group.getAttribute('data-testid') || `conversation-turn-${index}`,
            warnings: text ? [] : ['No rendered text extracted from this visible message.']
        };
    },

    captureCurrentConversation: async (options = {}) => {
        const conversationId = ChatGPTHandler.getCurrentConversationId();
        if (!conversationId) {
            throw new Error(i18n.t('uuidNotFound'));
        }

        if (options.scroll !== false) {
            await LoominaryDomCapture.scrollUntilStable(null, { maxPasses: 32, delay: Config.TIMING.SCROLL_DELAY });
        }

        const groups = ChatGPTHandler.getMessageGroups();
        const snapshot = LoominaryDomCapture.baseSnapshot('chatgpt', {
            provider: 'chatgpt',
            platform: 'chatgpt',
            conversationId,
            conversationUrl: `${window.location.origin}/c/${conversationId}`,
            title: ChatGPTHandler.getConversationTitle()
        });

        snapshot.messages = groups
            .map(ChatGPTHandler.extractMessage)
            .filter(message => message.text || message.images.length || message.attachments.length);

        if (snapshot.messages.length === 0) {
            snapshot.incomplete = true;
            snapshot.warnings.push('No visible conversation messages were found in the page DOM.');
        }

        return snapshot;
    },

    openConversation: async (conversation) => {
        const previousHref = window.location.href;
        const anchor = Array.from(document.querySelectorAll('a[href*="/c/"]'))
            .find(link => LoominaryDomCapture.absoluteUrl(link.getAttribute('href')) === conversation.url);
        if (anchor) {
            anchor.click();
        } else {
            window.history.pushState({}, '', conversation.url);
            window.dispatchEvent(new PopStateEvent('popstate'));
        }
        await LoominaryDomCapture.waitForLocationChange(previousHref);
        await LoominaryDomCapture.waitForMessages('[data-testid^="conversation-turn-"], [data-message-author-role]');
        await LoominaryDomCapture.sleep(600);
    },

    captureRecent: async (count) => {
        const conversations = ChatGPTHandler.discoverVisibleConversations().slice(0, count);
        if (conversations.length === 0) {
            throw new Error('No visible ChatGPT sidebar conversations found.');
        }

        const originalUrl = window.location.href;
        const snapshots = [];
        for (let index = 0; index < conversations.length; index += 1) {
            const conversation = conversations[index];
            try {
                await ChatGPTHandler.openConversation(conversation);
                const snapshot = await ChatGPTHandler.captureCurrentConversation({ scroll: true });
                snapshots.push(snapshot);
            } catch (error) {
                snapshots.push(LoominaryDomCapture.baseSnapshot('chatgpt', {
                    conversationId: conversation.id,
                    conversationUrl: conversation.url,
                    title: conversation.title,
                    incomplete: true,
                    warnings: [error.message || String(error)]
                }));
            }
        }
        if (window.location.href !== originalUrl) {
            window.location.href = originalUrl;
        }
        return snapshots;
    },

    previewConversation: async () => {
        try {
            const snapshot = await ChatGPTHandler.captureCurrentConversation();
            await LoominaryDomCapture.sendCaptureToViewer(
                { captureSnapshot: snapshot },
                `chatgpt_dom_${snapshot.conversationId || 'conversation'}.json`
            );
        } catch (error) {
            ErrorHandler.handle(error, 'Capture ChatGPT conversation', {
                userMessage: `${i18n.t('loadFailed')} ${error.message}`
            });
        }
    },

    exportCurrent: async (btn) => {
        const original = btn.innerHTML;
        Utils.setButtonLoading(btn, i18n.t('exporting'));
        try {
            const snapshot = await ChatGPTHandler.captureCurrentConversation();
            const baseName = `chatgpt_dom_${Utils.sanitizeFilename(snapshot.title)}_${new Date().toISOString().slice(0, 10)}`;
            Utils.downloadJSON(JSON.stringify(snapshot, null, 2), `${baseName}.json`);
        } catch (error) {
            ErrorHandler.handle(error, 'Export ChatGPT DOM capture');
        } finally {
            Utils.restoreButton(btn, original);
        }
    },

    exportAll: async (btn) => {
        const visibleConversations = ChatGPTHandler.discoverVisibleConversations();
        if (visibleConversations.length === 0) {
            alert('No visible sidebar conversations found.');
            return;
        }

        const userInput = prompt(i18n.t('selectExportCount'), String(visibleConversations.length));
        if (userInput === null) return;
        const count = Math.max(1, Math.min(parseInt(userInput, 10) || visibleConversations.length, visibleConversations.length));
        const original = btn.innerHTML;
        Utils.setButtonLoading(btn, i18n.t('exporting'));
        try {
            const snapshots = await ChatGPTHandler.captureRecent(count);
            await LoominaryDomCapture.sendCaptureToViewer(
                { captureSnapshots: snapshots },
                `chatgpt_dom_recent_${count}.json`
            );
        } catch (error) {
            ErrorHandler.handle(error, 'Capture recent ChatGPT conversations');
        } finally {
            Utils.restoreButton(btn, original);
        }
    },

    addUI: (controls) => {
        const imageToggle = Utils.createToggle(
            i18n.t('includeImages'),
            Config.IMAGE_SWITCH_ID,
            State.includeImages
        );

        imageToggle.querySelector('input')?.addEventListener('change', (event) => {
            State.includeImages = event.target.checked;
            localStorage.setItem('includeImages', State.includeImages);
        });

        controls.appendChild(imageToggle);
    },

    addButtons: (controls) => {
        controls.appendChild(Utils.createButton(
            `${previewIcon} ${i18n.t('viewOnline')}`,
            () => ChatGPTHandler.previewConversation()
        ));

        controls.appendChild(Utils.createButton(
            `${exportIcon} ${i18n.t('exportCurrentJSON')}`,
            (btn) => ChatGPTHandler.exportCurrent(btn)
        ));

        controls.appendChild(Utils.createButton(
            `${zipIcon} ${i18n.t('exportAllConversations')}`,
            (btn) => ChatGPTHandler.exportAll(btn)
        ));
    }
};
