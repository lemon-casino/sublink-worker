// Cloudflare requires a class export to host a Durable Object.
export class ShortLinkRevocations {
    constructor(state) {
        this.storage = state.storage;
    }

    async fetch(request) {
        if (request.method === 'POST') {
            await this.storage.put('revoked', true);
            return new Response(null, { status: 204 });
        }
        return Response.json({ revoked: await this.storage.get('revoked') === true });
    }
}

export function createShortLinkRevocations(binding) {
    const stubFor = code => binding.get(binding.idFromName(code));
    return {
        async isRevoked(code) {
            const response = await stubFor(code).fetch('https://revocations/status');
            if (!response.ok) throw new Error('Revocation check failed');
            return (await response.json()).revoked;
        },
        async revoke(code) {
            const response = await stubFor(code).fetch('https://revocations/revoke', { method: 'POST' });
            if (!response.ok) throw new Error('Revocation failed');
        }
    };
}
