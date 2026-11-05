import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createApp } from '../src/app/createApp.jsx';
import { MemoryKVAdapter } from '../src/adapters/kv/memoryKv.js';
import { ShortLinkService } from '../src/services/shortLinkService.js';
import { ConfigStorageService } from '../src/services/configStorageService.js';
import { createShortLinkRevocations } from '../src/services/shortLinkRevocations.js';

const ORIGIN = 'https://converter.example';
const ALIAS = 'https://custom.example';
const NODE = 'trojan://test@node.example:443?security=tls#Rotation';
const query = `?${new URLSearchParams({ config: NODE, include_auto_select: 'false', group_by_country: 'true' })}`;
const post = (app, path, body) => app.request(`${ORIGIN}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});
const fixture = () => {
    const kv = new MemoryKVAdapter();
    const app = createApp({ kv, config: { configTtlSeconds: 0, shortLinkTtlSeconds: 0, shortLinkOrigins: [ALIAS] } });
    return { kv, app };
};
const createLink = async app => {
    const response = await post(app, '/shorten-v2', { url: `${ORIGIN}/clash${query}` });
    expect(response.status).toBe(200);
    return response.text();
};

describe('Short-link validation and replacement', () => {
    it('recognizes configured aliases without exposing stored source parameters', async () => {
        const { app } = fixture();
        const code = await createLink(app);
        const result = await post(app, '/short-links/inspect', { url: `${ALIAS}/c/${code}` });
        expect(result.status).toBe(200);
        expect(await result.json()).toEqual({ valid: true });
        for (const origin of ['https://custom.example.attacker.example', 'https://foreign.example']) {
            expect((await post(app, '/short-links/inspect', { url: `${origin}/c/${code}` })).status).toBe(400);
            expect((await post(app, '/short-links/rotate', { url: `${origin}/c/${code}` })).status).toBe(400);
        }
    });

    it('preserves subscription settings and disables every old format after replacement', async () => {
        const { app, kv } = fixture();
        const code = await createLink(app);
        const previous = await (await app.request(`${ORIGIN}/b/${code}`)).json();
        const response = await post(app, '/short-links/rotate', { url: `${ALIAS}/c/${code}` });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(Object.keys(body)).toEqual(['code']);
        expect(body.code).toMatch(/^[A-Za-z0-9]{32}$/);
        expect(body.code).not.toBe(code);
        expect(await kv.get(`short:${code}`)).toBeNull();
        expect(await kv.get(`short:${body.code}`)).toBe(query);
        const next = await app.request(`${ORIGIN}/b/${body.code}`);
        expect(next.status).toBe(200);
        expect(await next.json()).toEqual(previous);
        for (const prefix of ['b', 'c', 's', 'x']) expect((await app.request(`${ORIGIN}/${prefix}/${code}`)).status).toBe(404);
        expect((await post(app, '/short-links/rotate', { url: `${ORIGIN}/b/${code}` })).status).toBe(404);
        expect((await post(app, '/short-links/inspect', { url: `${ORIGIN}/b/${code}` })).status).toBe(404);
    });

    it('copies the private config snapshot and removes only the old link snapshot', async () => {
        const { kv } = fixture();
        const storage = new ConfigStorageService(kv, { configTtlSeconds: 0 });
        const links = new ShortLinkService(kv, { configStorage: storage });
        const id = await storage.saveConfig('clash', { port: 8899 });
        await kv.put('legacy', `${query}&configId=${id}`);
        const next = await links.rotateShortLink('legacy');
        expect(await links.getBaseConfig(next)).toEqual({ type: 'clash', content: { port: 8899 } });
        expect(await links.resolveShortCode('legacy')).toBeNull();
        const newer = await links.rotateShortLink(next);
        expect(await kv.get(`short-config:${next}`)).toBeNull();
        expect(await links.getBaseConfig(newer)).toEqual({ type: 'clash', content: { port: 8899 } });
        expect(await storage.getConfigById(id)).toEqual({ port: 8899 });
    });

    it('does not create a new link from missing, deleted, malformed, or incomplete links', async () => {
        const { app, kv } = fixture();
        const code = await createLink(app);
        await post(app, '/short-links/delete', { url: `${ORIGIN}/b/${code}` });
        for (const suffix of [`b/${code}`, `c/${'X'.repeat(32)}`, 'b/', 'b/bad%20code']) {
            const response = await post(app, '/short-links/rotate', { url: `${ORIGIN}/${suffix}` });
            expect([400, 404]).toContain(response.status);
        }
        await kv.put('incomplete', '?config=test&hasBaseConfig=true');
        expect((await post(app, '/short-links/rotate', { url: `${ORIGIN}/b/incomplete` })).status).toBe(503);
        expect([...kv.store.keys()].filter(key => key.startsWith('short:'))).toHaveLength(0);
        const bypass = await post(app, '/shorten-v2', {
            url: `${ORIGIN}/clash?${new URLSearchParams({ config: `${ORIGIN}/b/${code}` })}`
        });
        expect(bypass.status).toBe(400);
    });

    it('keeps the old link valid and removes orphan snapshots if publishing the replacement fails', async () => {
        const kv = new MemoryKVAdapter();
        const links = new ShortLinkService(kv);
        const code = await links.createShortLink(query, undefined, { type: 'clash', content: { port: 8899 } });
        const put = kv.put.bind(kv);
        kv.put = async (key, value, options) => {
            if (key.startsWith('short:')) throw new Error('Simulated storage failure');
            return put(key, value, options);
        };
        await expect(links.rotateShortLink(code)).rejects.toThrow('Simulated storage failure');
        expect(await links.resolveShortCode(code)).not.toBeNull();
        expect([...kv.store.keys()].filter(key => key.startsWith('short-config:'))).toEqual([`short-config:${code}`]);
    });
});

describe('Cloudflare replacement concurrency', () => {
    const shared = () => {
        const kv = new MemoryKVAdapter();
        const first = new ShortLinkService(kv, { revocations: createShortLinkRevocations(env.SHORT_LINK_REVOCATIONS) });
        const second = new ShortLinkService(kv, { revocations: createShortLinkRevocations(env.SHORT_LINK_REVOCATIONS) });
        return { kv, first, second };
    };

    it('allows only one replacement across independent Worker service instances', async () => {
        const { kv, first, second } = shared();
        const code = await first.createShortLink(query);
        const results = await Promise.allSettled([first.rotateShortLink(code), second.rotateShortLink(code)]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
        const next = results.find(result => result.status === 'fulfilled').value;
        expect(await first.resolveShortCode(code)).toBeNull();
        expect(await second.resolveShortCode(next)).toBe(query);
        expect([...kv.store.keys()].filter(key => key.startsWith('short:'))).toEqual([`short:${next}`]);
    });

    it('does not publish a replacement if the original is deleted during rotation', async () => {
        const { kv, first, second } = shared();
        const code = await first.createShortLink(query);
        let signalStarted;
        let resume;
        const started = new Promise(resolve => { signalStarted = resolve; });
        const paused = new Promise(resolve => { resume = resolve; });
        const put = kv.put.bind(kv);
        kv.put = async (key, value, options) => {
            if (key.startsWith('short:')) { signalStarted(); await paused; }
            return put(key, value, options);
        };
        const rotating = first.rotateShortLink(code);
        const failure = expect(rotating).rejects.toMatchObject({ status: 409 });
        await started;
        await second.deleteShortLink(code);
        resume();
        await failure;
        expect([...kv.store.keys()].filter(key => key.startsWith('short:'))).toHaveLength(0);
    });
});
