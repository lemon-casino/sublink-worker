import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createShortLinkRevocations } from '../src/services/shortLinkRevocations.js';

describe('Cloudflare revocation binding', () => {
    it('persists revocation across independent stubs', async () => {
        const code = crypto.randomUUID();
        const first = createShortLinkRevocations(env.SHORT_LINK_REVOCATIONS);
        expect(await first.isRevoked(code)).toBe(false);
        await first.revoke(code);
        const second = createShortLinkRevocations(env.SHORT_LINK_REVOCATIONS);
        expect(await second.isRevoked(code)).toBe(true);
    });
});
