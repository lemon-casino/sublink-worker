export function normalizeShortLinkOrigins(value = []) {
    const entries = Array.isArray(value) ? value : String(value).split(',');
    return [...new Set(entries.map(entry => {
        try {
            const url = new URL(entry.trim());
            return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.origin : null;
        } catch { return null; }
    }).filter(Boolean))].slice(0, 16);
}

export function parseLocalShortLink(value, origin, aliases = []) {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value.trim());
        const match = url.pathname.match(/^\/([bcxs])\/([A-Za-z0-9_-]{1,128})$/);
        if (!match || url.username || url.password || ![origin, ...aliases].includes(url.origin)) return null;
        return { code: match[2], prefix: match[1] };
    } catch { return null; }
}
