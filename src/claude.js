const ClaudeHandler = {
    init: () => {},

    getCurrentUUID: () => window.location.pathname.match(/\/chat\/([a-zA-Z0-9-]+)/)?.[1] || null,

    getConversationTitle: () => {
        const activeSidebar = document.querySelector('a[href="' + window.location.pathname + '"], a[href="' + window.location.href + '"]');
        const candidates = [
            document.querySelector('main h1'),
            document.querySelector('[data-testid="chat-title"]'),
            activeSidebar,
            document.querySelector('title')
        ];
        for (const element of candidates) {
            const text = LoominaryDomCapture.normalizeText(element?.innerText || element?.textContent);
            if (text && !/^claude$/i.test(text)) return text.replace(/\s*[-|]\s*Claude.*$/i, '');
        }
        return 'Claude conversation';
    },

    discoverVisibleConversations: () => {
        const byId = new Map();
        document.querySelectorAll('a[href*="/chat/"]').forEach(anchor => {
            if (!LoominaryDomCapture.isVisible(anchor)) return;
            const href = LoominaryDomCapture.absoluteUrl(anchor.getAttribute('href'));
            const match = href.match(/\/chat\/([a-zA-Z0-9-]+)/);
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
        const selectors = [
            '[data-testid^="user-message"]',
            '[data-testid^="assistant-message"]',
            '[data-testid*="chat-message"]',
            '[data-testid*="message"]',
            'div[class*="font-user-message"]',
            'div[class*="font-claude-message"]'
        ];
        const seen = new Set();
        const groups = [];
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(node => {
                const group = node.closest('[data-testid*="message"]') || node.closest('article') || node;
                if (!LoominaryDomCapture.isVisible(group)) return;
                if (seen.has(group)) return;
                seen.add(group);
                groups.push(group);
            });
        });

        if (groups.length > 0) {
            return groups.sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top);
        }

        return Array.from(document.querySelectorAll('main article, main [role="article"]'))
            .filter(LoominaryDomCapture.isVisible);
    },

    extractRole: (group, index) => {
        const testId = group.getAttribute('data-testid') || '';
        const className = String(group.className || '');
        const label = group.getAttribute('aria-label') || '';
        const combined = `${testId} ${className} ${label}`;
        if (/user|human|font-user-message/i.test(combined)) return 'user';
        if (/assistant|claude|font-claude-message/i.test(combined)) return 'assistant';
        return index % 2 === 0 ? 'user' : 'assistant';
    },

    extractArtifacts: (group) => {
        const artifactSelectors = [
            '[data-testid*="artifact"]',
            '[aria-label*="artifact" i]',
            'pre code',
            '.code-block',
            '[class*="artifact"]'
        ].join(',');
        const seen = new Set();
        return Array.from(group.querySelectorAll(artifactSelectors))
            .filter(LoominaryDomCapture.isVisible)
            .map((element, index) => {
                const content = LoominaryDomCapture.elementText(element);
                if (!content || seen.has(content)) return null;
                seen.add(content);
                return {
                    id: element.id || `artifact-${LoominaryDomCapture.hashString(content + index)}`,
                    title: element.getAttribute('aria-label') || element.getAttribute('data-testid') || 'Visible artifact',
                    type: element.matches('pre code, .code-block') ? 'code' : 'artifact',
                    content
                };
            })
            .filter(Boolean);
    },

    extractVisibleContext: () => {
        const contextSelectors = [
            '[data-testid*="project"]',
            '[data-testid*="context"]',
            '[aria-label*="project" i]',
            '[aria-label*="memory" i]',
            'aside'
        ];
        const blocks = contextSelectors
            .flatMap(selector => Array.from(document.querySelectorAll(selector)))
            .filter(LoominaryDomCapture.isVisible)
            .map((element, index) => ({
                id: element.id || `visible-context-${index}`,
                title: LoominaryDomCapture.normalizeText(element.getAttribute('aria-label') || element.getAttribute('data-testid') || 'Visible context'),
                content: LoominaryDomCapture.elementText(element)
            }))
            .filter(block => block.content && block.content.length > 20);

        if (blocks.length === 0) return null;

        return {
            visible: blocks,
            projectInfo: {
                name: blocks.find(block => /project/i.test(block.title))?.content.split('\n')[0] || '',
                knowledgeFiles: blocks
                    .filter(block => /file|knowledge|context/i.test(block.title + block.content))
                    .map(block => ({ id: block.id, name: block.title, summary: block.content.slice(0, 300) }))
            }
        };
    },

    extractMessage: (group, index) => {
        const role = ClaudeHandler.extractRole(group, index);
        const contentRoot = group.querySelector('.font-user-message, .font-claude-message, [data-testid*="message"]') || group;
        const text = LoominaryDomCapture.elementText(contentRoot);

        return {
            id: group.getAttribute('data-message-id') || group.id || null,
            role,
            senderLabel: role === 'user' ? 'User' : 'Claude',
            text,
            images: LoominaryDomCapture.extractImages(group, State.includeImages),
            attachments: LoominaryDomCapture.extractAttachments(group),
            links: LoominaryDomCapture.extractLinks(contentRoot),
            artifacts: role === 'assistant' ? ClaudeHandler.extractArtifacts(group) : [],
            branchEvidence: LoominaryDomCapture.extractBranchEvidence(group),
            domPath: group.getAttribute('data-testid') || `claude-message-${index}`,
            warnings: text ? [] : ['No rendered text extracted from this visible message.']
        };
    },

    captureCurrentConversation: async (options = {}) => {
        const uuid = ClaudeHandler.getCurrentUUID();
        if (!uuid) {
            throw new Error(i18n.t('uuidNotFound'));
        }

        if (options.scroll !== false) {
            await LoominaryDomCapture.scrollUntilStable(null, { maxPasses: 32, delay: Config.TIMING.SCROLL_DELAY });
        }

        const groups = ClaudeHandler.getMessageGroups();
        const snapshot = LoominaryDomCapture.baseSnapshot('claude', {
            provider: 'claude',
            platform: 'claude',
            conversationId: uuid,
            conversationUrl: `${window.location.origin}/chat/${uuid}`,
            title: ClaudeHandler.getConversationTitle(),
            context: ClaudeHandler.extractVisibleContext()
        });

        snapshot.messages = groups
            .map(ClaudeHandler.extractMessage)
            .filter(message => message.text || message.images.length || message.attachments.length || message.artifacts.length);

        if (snapshot.messages.length === 0) {
            snapshot.incomplete = true;
            snapshot.warnings.push('No visible conversation messages were found in the page DOM.');
        }

        return snapshot;
    },

    openConversation: async (conversation) => {
        const previousHref = window.location.href;
        const anchor = Array.from(document.querySelectorAll('a[href*="/chat/"]'))
            .find(link => LoominaryDomCapture.absoluteUrl(link.getAttribute('href')) === conversation.url);
        if (anchor) {
            anchor.click();
        } else {
            window.history.pushState({}, '', conversation.url);
            window.dispatchEvent(new PopStateEvent('popstate'));
        }
        await LoominaryDomCapture.waitForLocationChange(previousHref);
        await LoominaryDomCapture.waitForMessages('[data-testid*="message"], .font-user-message, .font-claude-message');
        await LoominaryDomCapture.sleep(600);
    },

    captureRecent: async (count) => {
        const conversations = ClaudeHandler.discoverVisibleConversations().slice(0, count);
        if (conversations.length === 0) {
            throw new Error('No visible Claude sidebar conversations found.');
        }

        const originalUrl = window.location.href;
        const snapshots = [];
        for (let index = 0; index < conversations.length; index += 1) {
            const conversation = conversations[index];
            try {
                await ClaudeHandler.openConversation(conversation);
                snapshots.push(await ClaudeHandler.captureCurrentConversation({ scroll: true }));
            } catch (error) {
                snapshots.push(LoominaryDomCapture.baseSnapshot('claude', {
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

    addUI: (controlsArea) => {
        const imageToggle = Utils.createToggle(i18n.t('includeImages'), Config.IMAGE_SWITCH_ID, State.includeImages);
        imageToggle.querySelector('input')?.addEventListener('change', (event) => {
            State.includeImages = event.target.checked;
            localStorage.setItem('includeImages', State.includeImages);
        });
        controlsArea.appendChild(imageToggle);
    },

    addButtons: (controlsArea) => {
        controlsArea.appendChild(Utils.createButton(
            `${previewIcon} ${i18n.t('viewOnline')}`,
            async () => {
                try {
                    const snapshot = await ClaudeHandler.captureCurrentConversation();
                    await LoominaryDomCapture.sendCaptureToViewer(
                        { captureSnapshot: snapshot },
                        `claude_dom_${snapshot.conversationId || 'conversation'}.json`
                    );
                } catch (error) {
                    ErrorHandler.handle(error, 'Capture Claude conversation', {
                        userMessage: `${i18n.t('loadFailed')} ${error.message}`
                    });
                }
            }
        ));

        controlsArea.appendChild(Utils.createButton(
            `${exportIcon} ${i18n.t('exportCurrentJSON')}`,
            async (btn) => {
                const original = btn.innerHTML;
                Utils.setButtonLoading(btn, i18n.t('exporting'));
                try {
                    const snapshot = await ClaudeHandler.captureCurrentConversation();
                    const baseName = `claude_dom_${Utils.sanitizeFilename(snapshot.title)}_${new Date().toISOString().slice(0, 10)}`;
                    Utils.downloadJSON(JSON.stringify(snapshot, null, 2), `${baseName}.json`);
                } catch (error) {
                    ErrorHandler.handle(error, 'Export Claude DOM capture');
                } finally {
                    Utils.restoreButton(btn, original);
                }
            }
        ));

        controlsArea.appendChild(Utils.createButton(
            `${zipIcon} ${i18n.t('exportAllConversations')}`,
            async (btn) => {
                const visibleConversations = ClaudeHandler.discoverVisibleConversations();
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
                    const snapshots = await ClaudeHandler.captureRecent(count);
                    await LoominaryDomCapture.sendCaptureToViewer(
                        { captureSnapshots: snapshots },
                        `claude_dom_recent_${count}.json`
                    );
                } catch (error) {
                    ErrorHandler.handle(error, 'Capture recent Claude conversations');
                } finally {
                    Utils.restoreButton(btn, original);
                }
            }
        ));
    }
};
