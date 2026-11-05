const WINDOW_MS = 60_000;
const MAX_CLIENTS = 10_000;

export function createRequestSecurity(runtime) {
    const windows = new Map();
    return async (c, next) => {
        c.header('Cache-Control', 'no-store');
        c.header('Referrer-Policy', 'no-referrer');
        c.header('X-Content-Type-Options', 'nosniff');
        c.header('X-Frame-Options', 'DENY');
        c.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.github.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");

        if (c.req.path.startsWith('/assets/') || c.req.path.startsWith('/favicon.')) return next();
        const writing = c.req.method === 'POST';
        if (writing) {
            const origin = c.req.header('Origin');
            if (origin && origin !== new URL(c.req.url).origin) return c.text('Cross-origin writes are not allowed', 403);
            if (!c.req.header('Content-Type')?.toLowerCase().startsWith('application/json')) return c.text('JSON content type is required', 415);
        }

        const client = runtime.clientIp?.(c.req.raw) || 'unknown';
        const key = `${writing ? 'write' : 'read'}:${client}`;
        let allowed;
        if (runtime.rateLimit) {
            allowed = await runtime.rateLimit(key, writing);
        } else {
            const now = Date.now();
            let entry = windows.get(key);
            if (!entry || now >= entry.expires) {
                // Bounding this cache prevents anonymous traffic from growing process memory forever.
                if (windows.size >= MAX_CLIENTS && !windows.has(key)) {
                    for (const [id, value] of windows) if (now >= value.expires) windows.delete(id);
                    if (windows.size >= MAX_CLIENTS) return c.text('Too many requests', 429);
                }
                entry = { count: 0, expires: now + WINDOW_MS };
                windows.set(key, entry);
            }
            allowed = ++entry.count <= (writing ? 10 : 120);
        }
        if (!allowed) {
            c.header('Retry-After', '60');
            return c.text('Too many requests', 429);
        }
        await next();
    };
}
