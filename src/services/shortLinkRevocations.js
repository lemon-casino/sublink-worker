import { ServiceError } from './errors.js';

// Cloudflare requires a class export to host a Durable Object.
export class ShortLinkRevocations {
    constructor(state) {
        this.storage = state.storage;
    }

    async fetch(request) {
        if (request.method === 'POST') {
            const path = new URL(request.url).pathname;
            const token = path === '/rotation/complete' || path === '/rotation/cancel' ? (await request.json()).token : undefined;
            const transition = async storage => {
                if (path === '/rotation/begin') {
                    if (await storage.get('revoked')) return new Response('Short link is no longer active', { status: 410 });
                    const previous = await storage.get('rotation');
                    if (previous && previous.expires > Date.now()) return new Response('Short link is being replaced', { status: 409 });
                    const lease = { token: crypto.randomUUID(), expires: Date.now() + 120_000 };
                    await storage.put('rotation', lease);
                    return Response.json({ token: lease.token });
                }
                if (path === '/rotation/complete' || path === '/rotation/cancel') {
                    const lease = await storage.get('rotation');
                    if (path === '/rotation/cancel') {
                        if (lease?.token === token) await storage.delete('rotation');
                        return new Response(null, { status: 204 });
                    }
                    if (!lease || lease.token !== token || lease.expires <= Date.now() || await storage.get('revoked')) {
                        return new Response('Short link is no longer active', { status: 409 });
                    }
                } else if (path !== '/revoke') return new Response('Not found', { status: 404 });
                await storage.put('revoked', true);
                await storage.delete('rotation');
                return new Response(null, { status: 204 });
            };
            // Native storage transactions serialize rotation and deletion across Worker instances.
            return this.storage.transaction ? this.storage.transaction(transition) : transition(this.storage);
        }
        return Response.json({ revoked: await this.storage.get('revoked') === true });
    }
}

export function createShortLinkRevocations(binding) {
    const stubFor = code => binding.get(binding.idFromName(code));
    const update = async (code, path, token) => {
        const response = await stubFor(code).fetch(`https://revocations${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        if (!response.ok) throw new ServiceError('Short link is no longer active or is being replaced', response.status === 410 ? 410 : 409);
        return response.status === 204 ? undefined : (await response.json()).token;
    };
    return {
        async isRevoked(code) {
            const response = await stubFor(code).fetch('https://revocations/status');
            if (!response.ok) throw new Error('Revocation check failed');
            return (await response.json()).revoked;
        },
        async revoke(code) {
            await update(code, '/revoke');
        },
        beginRotation: code => update(code, '/rotation/begin'),
        completeRotation: (code, token) => update(code, '/rotation/complete', token),
        cancelRotation: (code, token) => update(code, '/rotation/cancel', token)
    };
}
