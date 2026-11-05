import { decodeBase64 } from '../../utils.js';
import { parseSubscriptionContent } from './subscriptionContentParser.js';

const SUBSCRIPTION_URI_PATTERN = /^(ss|vmess|vless|hysteria|hysteria2|hy2|trojan|tuic|anytls|http|https):\/\//i;

function hasSubscriptionUriLine(content) {
    return content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .some(line => SUBSCRIPTION_URI_PATTERN.test(line));
}

function isLikelyTomlConfig(content) {
    return /^\s*\[[^\]]+\]\s*$/m.test(content) && /^\s*[A-Za-z0-9_.-]+\s*=/.test(content);
}

function isPlainSubscriptionContent(content) {
    if (!content || typeof content !== 'string') {
        return false;
    }
    return detectFormat(content) !== 'unknown' ||
        hasSubscriptionUriLine(content) ||
        isLikelyTomlConfig(content);
}

function decodeUriComponentIfNeeded(text) {
    const trimmed = text.trim();
    if (!trimmed.includes('%')) {
        return trimmed;
    }

    try {
        return decodeURIComponent(trimmed).trim();
    } catch (urlError) {
        console.warn('Unable to URL decode subscription content');
        return trimmed;
    }
}

function normalizeBase64Candidate(text) {
    const compact = text.replace(/\s+/g, '');
    if (!compact || !/^[A-Za-z0-9+/_-]*={0,2}$/.test(compact)) {
        return null;
    }
    if (/=/.test(compact.replace(/={0,2}$/, ''))) {
        return null;
    }

    const withoutPadding = compact.replace(/=+$/, '');
    if (withoutPadding.length % 4 === 1) {
        return null;
    }

    const normalized = withoutPadding.replace(/-/g, '+').replace(/_/g, '/');
    return normalized + '='.repeat((4 - normalized.length % 4) % 4);
}

/**
 * Decode content only when the payload proves it is an encoded subscription.
 * @param {string} text - Raw text content
 * @returns {string} - Decoded content
 */
function decodeContent(text) {
    const urlDecodedText = decodeUriComponentIfNeeded(text);
    if (isPlainSubscriptionContent(urlDecodedText)) {
        return urlDecodedText;
    }

    const base64Candidate = normalizeBase64Candidate(urlDecodedText);
    if (!base64Candidate) {
        return urlDecodedText;
    }

    try {
        const decodedText = decodeUriComponentIfNeeded(decodeBase64(base64Candidate));
        if (isPlainSubscriptionContent(decodedText)) {
            return decodedText;
        }
    } catch (e) {
        return urlDecodedText;
    }

    return urlDecodedText;
}

/**
 * Detect the format of subscription content
 * @param {string} content - Decoded subscription content
 * @returns {'clash'|'singbox'|'surge'|'unknown'} - Detected format
 */
function detectFormat(content) {
    const trimmed = content.trim();

    // Try JSON (Sing-Box format)
    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed.outbounds || parsed.inbounds || parsed.route) {
                return 'singbox';
            }
        } catch {
            // Not valid JSON
        }
    }

    // Try YAML (Clash format) - check for proxies: key
    if (trimmed.includes('proxies:')) {
        return 'clash';
    }

    if (/\[(General|Proxy|Rule|Proxy Group)\]/i.test(trimmed)) {
        return 'surge';
    }

    return 'unknown';
}

/**
 * Fetch subscription content from a URL and parse it
 * @param {string} url - The subscription URL to fetch
 * @param {string} userAgent - Optional User-Agent header
 * @returns {Promise<object|string[]|null>} - Parsed subscription content
 */
export async function fetchSubscription(url, userAgent) {
    const subscription = await fetchSubscriptionWithFormat(url, userAgent);
    return subscription ? parseSubscriptionContent(subscription.content) : null;
}

/**
 * Fetch subscription content and detect its format without parsing
 * @param {string} url - The subscription URL to fetch
 * @param {string} userAgent - Optional User-Agent header
 * @returns {Promise<{content: string, format: 'clash'|'singbox'|'surge'|'unknown', url: string, subscriptionUserinfo?: string}|null>}
 */
export async function fetchSubscriptionWithFormat(url, userAgent) {
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) return null;
        const headers = new Headers();
        if (userAgent) {
            headers.set('User-Agent', userAgent);
        }
        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
            signal: AbortSignal.timeout(15_000)
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await readSubscriptionText(response);
        const content = decodeContent(text);
        const format = detectFormat(content);

        const subscriptionUserinfo = response.headers.get('subscription-userinfo') || undefined;

        return { content, format, url, subscriptionUserinfo };
    } catch (error) {
        console.error('Unable to fetch or parse a subscription');
        return null;
    }
}

async function readSubscriptionText(response) {
    const maxBytes = 2 * 1024 * 1024;
    if (Number(response.headers.get('content-length')) > maxBytes) {
        await response.body?.cancel();
        throw new Error('Subscription response too large');
    }
    if (!response.body?.getReader) {
        const text = await response.text();
        if (new TextEncoder().encode(text).length > maxBytes) throw new Error('Subscription response too large');
        return text;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    let result = '';
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > maxBytes) {
                await reader.cancel();
                throw new Error('Subscription response too large');
            }
            result += decoder.decode(value, { stream: true });
        }
        return result + decoder.decode();
    } finally {
        reader.releaseLock();
    }
}
