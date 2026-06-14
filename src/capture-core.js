const LoominaryDomCapture = (() => {
    const RAW_CAPTURE_SCHEMA_VERSION = 'loominary.capture.raw/v1';

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const normalizeText = (value) => String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();

    const isVisible = (element) => {
        if (!element || !(element instanceof Element)) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            Number(style.opacity || 1) > 0;
    };

    const elementText = (element) => {
        if (!element) return '';
        const clone = element.cloneNode(true);
        clone.querySelectorAll('script, style, svg, button, [aria-hidden="true"], [role="button"]').forEach(node => node.remove());
        return normalizeText(clone.innerText || clone.textContent || '');
    };

    const hashString = (value) => {
        const text = String(value || '');
        let hash = 2166136261;
        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    };

    const absoluteUrl = (value) => {
        if (!value) return '';
        try {
            return new URL(value, window.location.href).href;
        } catch (_) {
            return String(value);
        }
    };

    const extractImages = (root, includeImages = true) => {
        if (!includeImages || !root) return [];
        const seen = new Set();
        return Array.from(root.querySelectorAll('img'))
            .filter(isVisible)
            .map((img, index) => {
                const src = img.currentSrc || img.src || img.getAttribute('src') || '';
                if (!src || seen.has(src)) return null;
                seen.add(src);
                const width = img.naturalWidth || img.width || Math.round(img.getBoundingClientRect().width);
                const height = img.naturalHeight || img.height || Math.round(img.getBoundingClientRect().height);
                if (width < 24 || height < 24) return null;
                return {
                    id: img.id || `img-${hashString(src + index)}`,
                    src: absoluteUrl(src),
                    alt: img.alt || img.getAttribute('aria-label') || '',
                    width,
                    height,
                    source: 'visible-dom'
                };
            })
            .filter(Boolean);
    };

    const extractLinks = (root) => {
        if (!root) return [];
        const seen = new Set();
        return Array.from(root.querySelectorAll('a[href]'))
            .filter(isVisible)
            .map((anchor, index) => {
                const href = absoluteUrl(anchor.getAttribute('href'));
                const text = normalizeText(anchor.innerText || anchor.textContent || anchor.getAttribute('aria-label'));
                if (!href || seen.has(href + text)) return null;
                seen.add(href + text);
                return {
                    id: anchor.id || `link-${hashString(href + text + index)}`,
                    title: text || href,
                    url: href,
                    text
                };
            })
            .filter(Boolean);
    };

    const extractAttachments = (root) => {
        if (!root) return [];
        const selectors = [
            '[data-testid*="attachment"]',
            '[data-testid*="file"]',
            '[aria-label*="attachment" i]',
            '[aria-label*="file" i]',
            'a[href*="attachment"]',
            'a[href*="file"]'
        ].join(',');
        const seen = new Set();
        return Array.from(root.querySelectorAll(selectors))
            .filter(isVisible)
            .map((element, index) => {
                const link = element.matches('a[href]')
                    ? element.getAttribute('href')
                    : element.querySelector('a[href]')?.getAttribute('href');
                const text = elementText(element);
                const key = `${link || ''}|${text}`;
                if (!text && !link) return null;
                if (seen.has(key)) return null;
                seen.add(key);
                return {
                    id: element.id || `att-${hashString(key + index)}`,
                    name: text.split('\n')[0] || 'Visible attachment',
                    url: absoluteUrl(link),
                    text
                };
            })
            .filter(Boolean);
    };

    const extractBranchEvidence = (root) => {
        if (!root) return [];
        const patterns = /(branch|version|response|regenerate|previous|next|retry|try again|替换|版本|重新生成|上一个|下一个)/i;
        const seen = new Set();
        return Array.from(root.querySelectorAll('button, [role="button"], [aria-label]'))
            .filter(isVisible)
            .map(element => normalizeText(element.getAttribute('aria-label') || element.innerText || element.textContent || ''))
            .filter(text => text && patterns.test(text))
            .filter(text => {
                if (seen.has(text)) return false;
                seen.add(text);
                return true;
            });
    };

    const getScrollRoot = () => document.scrollingElement || document.documentElement || document.body;

    const scrollUntilStable = async (root = null, options = {}) => {
        const target = root || getScrollRoot();
        const maxPasses = options.maxPasses || 40;
        const delay = options.delay || 250;
        let stablePasses = 0;
        let previousHeight = -1;

        for (let pass = 0; pass < maxPasses && stablePasses < 3; pass += 1) {
            const height = target.scrollHeight || document.body.scrollHeight;
            if (height === previousHeight) {
                stablePasses += 1;
            } else {
                stablePasses = 0;
                previousHeight = height;
            }
            target.scrollTo({ top: height, behavior: 'instant' });
            await sleep(delay);
        }
    };

    const waitForLocationChange = async (previousHref, timeout = 12000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (window.location.href !== previousHref) return true;
            await sleep(150);
        }
        return false;
    };

    const waitForMessages = async (selector, timeout = 12000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (document.querySelector(selector)) return true;
            await sleep(200);
        }
        return false;
    };

    const baseSnapshot = (provider, extras = {}) => ({
        schemaVersion: RAW_CAPTURE_SCHEMA_VERSION,
        provider,
        platform: provider,
        capturedAt: new Date().toISOString(),
        capturedUrl: window.location.href,
        conversationUrl: extras.conversationUrl || window.location.href,
        conversationId: extras.conversationId || null,
        title: extras.title || normalizeText(document.title.replace(/[-|]?\\s*(ChatGPT|Claude).*$/i, '')) || document.title,
        messages: [],
        warnings: [],
        ...extras
    });

    const sendCaptureToViewer = async (payload, filename) => {
        return Communicator.open(null, filename, payload);
    };

    return {
        RAW_CAPTURE_SCHEMA_VERSION,
        absoluteUrl,
        baseSnapshot,
        elementText,
        extractAttachments,
        extractBranchEvidence,
        extractImages,
        extractLinks,
        hashString,
        isVisible,
        normalizeText,
        scrollUntilStable,
        sendCaptureToViewer,
        sleep,
        waitForLocationChange,
        waitForMessages
    };
})();
