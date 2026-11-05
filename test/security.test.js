import { afterEach, describe, expect, it, vi } from 'vitest';
import yaml from 'js-yaml';
import { createApp } from '../src/app/createApp.jsx';
import { MemoryKVAdapter } from '../src/adapters/kv/memoryKv.js';
import { ShortLinkService } from '../src/services/shortLinkService.js';
import { ConfigStorageService } from '../src/services/configStorageService.js';
import { ShortLinkRevocations, createShortLinkRevocations } from '../src/services/shortLinkRevocations.js';
import { fetchSubscriptionWithFormat } from '../src/parsers/subscription/httpSubscriptionFetcher.js';

const ORIGIN = 'https://converter.example';
const NODE = 'trojan://node-password@node.example:443?security=tls#Test';
const sourceUrl = config => `${ORIGIN}/clash?${new URLSearchParams({ config })}`;
const createTestApp = (bindings = {}) => createApp({
    kv: new MemoryKVAdapter(),
    config: { configTtlSeconds: 0, shortLinkTtlSeconds: 0 },
    ...bindings
});
const post = (app, path, body, headers = {}) => app.request(`${ORIGIN}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body)
});
const createLink = async (app, config = NODE) => {
    const response = await post(app, '/shorten-v2', { url: sourceUrl(config) });
    expect(response.status).toBe(200);
    return response.text();
};

afterEach(() => vi.restoreAllMocks());

describe('Private immutable short links', () => {
    it('rejects chosen codes and legacy GET writes without modifying the existing link', async () => {
        const app = createTestApp();
        const code = await createLink(app);
        expect(code).toMatch(/^[A-Za-z0-9]{32}$/);
        const replacement = { url: sourceUrl('trojan://attacker@evil.example:443'), shortCode: code };
        expect((await post(app, '/shorten-v2', replacement)).status).toBe(400);
        expect((await app.request(`${ORIGIN}/shorten-v2?${new URLSearchParams(replacement)}`)).status).toBe(405);
        const result = await app.request(`${ORIGIN}/b/${code}`);
        expect(result.status).toBe(200);
        expect(result.headers.get('location')).toBeNull();
        expect(await result.text()).toContain('node.example');
    });

    it('returns configurations directly and never embeds an automatic source provider', async () => {
        const upstream = 'https://provider.example/subscribe?token=PRIVATE_SOURCE_TOKEN';
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(`proxies:
  - name: Test
    type: trojan
    server: node.example
    port: 443
    password: node-password
`, { headers: { 'subscription-userinfo': 'upload=1; download=2; total=100' } }));
        const app = createTestApp();
        const code = await createLink(app, upstream);
        for (const prefix of ['b', 'c', 's', 'x']) {
            const result = await app.request(`${ORIGIN}/${prefix}/${code}`);
            expect(result.status).toBe(200);
            expect(result.headers.get('location')).toBeNull();
            expect(result.headers.get('subscription-userinfo')).toContain('total=100');
            const body = await result.text();
            expect(body).not.toContain('PRIVATE_SOURCE_TOKEN');
            if (prefix === 'c') expect(yaml.load(body)['proxy-providers']).toBeUndefined();
            if (prefix === 's') expect(body).toContain(`#!MANAGED-CONFIG ${ORIGIN}/s/${code}`);
        }
        expect((await app.request(`${ORIGIN}/resolve?url=${encodeURIComponent(`${ORIGIN}/c/${code}`)}`)).status).toBe(410);
    });

    it('inlines explicit providers and preserves their group members', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(`proxies:
  - name: ProviderNode
    type: trojan
    server: node.example
    port: 443
    password: test
`));
        const input = `proxy-providers:
  private:
    type: http
    url: https://provider.example/sub?token=PRIVATE_SOURCE_TOKEN
proxy-groups:
  - name: Imported
    type: select
    use: [private]
`;
        const app = createTestApp();
        const code = await createLink(app, input);
        const response = await app.request(`${ORIGIN}/c/${code}`);
        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).not.toContain('PRIVATE_SOURCE_TOKEN');
        const config = yaml.load(text);
        expect(config['proxy-providers']).toBeUndefined();
        expect(config['proxy-groups'].find(group => group.name === 'Imported').proxies).toContain('ProviderNode');
    });

    it('deletes every format, removes its snapshot, and allows a fresh link', async () => {
        const kv = new MemoryKVAdapter();
        const app = createTestApp({ kv });
        const storage = new ConfigStorageService(kv, { configTtlSeconds: 0 });
        const configId = await storage.saveConfig('clash', { 'log-level': 'warning' });
        const url = new URL(sourceUrl(NODE));
        url.searchParams.set('configId', configId);
        const created = await post(app, '/shorten-v2', { url: url.href });
        const code = await created.text();
        expect(await kv.get(`short-config:${code}`)).not.toBeNull();
        const converted = await app.request(`${ORIGIN}/c/${code}`);
        expect(converted.status).toBe(200);
        expect(yaml.load(await converted.text())['log-level']).toBe('warning');
        expect((await post(app, '/short-links/delete', { url: `${ORIGIN}/b/${code}` })).status).toBe(200);
        expect(await kv.get(`short:${code}`)).toBeNull();
        expect(await kv.get(`short-config:${code}`)).toBeNull();
        for (const prefix of ['b', 'c', 's', 'x']) expect((await app.request(`${ORIGIN}/${prefix}/${code}`)).status).toBe(404);
        expect((await post(app, '/short-links/delete', { url: `${ORIGIN}/c/${code}` })).status).toBe(200);
        expect(await storage.getConfigById(configId)).toEqual({ 'log-level': 'warning' });
        const nextCode = await createLink(app);
        expect(nextCode).not.toBe(code);
        expect((await app.request(`${ORIGIN}/b/${nextCode}`)).status).toBe(200);
    });

    it('reads and revokes legacy links without treating base config IDs as short links', async () => {
        const kv = new MemoryKVAdapter();
        await kv.put('legacy7', `?${new URLSearchParams({ config: NODE })}`);
        await kv.put('singbox_saved', JSON.stringify({ secret: 'BASE_CONFIG_SECRET' }));
        const app = createTestApp({ kv });
        expect((await app.request(`${ORIGIN}/b/legacy7`)).status).toBe(200);
        const leak = await app.request(`${ORIGIN}/b/singbox_saved`);
        expect(leak.status).toBe(404);
        expect(await leak.text()).not.toContain('BASE_CONFIG_SECRET');
        expect((await post(app, '/short-links/delete', { url: `${ORIGIN}/c/legacy7` })).status).toBe(200);
        expect(await kv.get('legacy7')).toBeNull();
        expect((await app.request(`${ORIGIN}/b/legacy7`)).status).toBe(404);
        expect(await kv.get('singbox_saved')).not.toBeNull();
    });

    it('rejects foreign URLs, cross-origin writes, oversized bodies, and excessive writes', async () => {
        const app = createTestApp();
        expect((await post(app, '/short-links/delete', { url: 'https://other.example/b/code' })).status).toBe(400);
        expect((await post(app, '/shorten-v2', { url: sourceUrl(NODE) }, { Origin: 'https://other.example' })).status).toBe(403);
        expect((await post(app, '/config', { type: 'clash', content: 'x'.repeat(1024 * 1024) })).status).toBe(413);
        const limited = createTestApp();
        for (let i = 0; i < 10; i++) expect((await post(limited, '/config', { type: 'clash', content: {} })).status).toBe(200);
        const blocked = await post(limited, '/config', { type: 'clash', content: {} });
        expect(blocked.status).toBe(429);
        expect(blocked.headers.get('retry-after')).toBe('60');
    });
});

describe('Revocation consistency', () => {
    it('rejects stale KV values after the revocation is acknowledged', async () => {
        const state = new MemoryKVAdapter();
        const object = new ShortLinkRevocations({ storage: state });
        const revocations = createShortLinkRevocations({
            idFromName: code => code,
            get: () => ({ fetch: (url, init) => object.fetch(new Request(url, init)) })
        });
        const kv = new MemoryKVAdapter();
        const links = new ShortLinkService(kv, { revocations });
        const query = `?${new URLSearchParams({ config: NODE })}`;
        const code = await links.createShortLink(query);
        await links.deleteShortLink(code);
        await kv.put(`short:${code}`, query);
        expect(await links.resolveShortCode(code)).toBeNull();
    });
});

describe('Browser and client defaults', () => {
    it('loads resources locally and reuses source input for short-link management', async () => {
        const response = await createTestApp().request(`${ORIGIN}/`);
        const html = await response.text();
        expect(html.includes('id="delete-short-url"')).toBe(false);
        expect(html.includes('id="primary-action"')).toBe(true);
        expect(html.includes('id="rotate-short-link"')).toBe(true);
        expect(html.includes('id="advanced-options-dialog"')).toBe(true);
        expect(html).toContain('deleteShortLink()');
        expect(html).not.toMatch(/<(?:script|link)[^>]+(?:src|href)="https?:\/\//);
        expect(html).not.toContain('x-model="customShortCode"');
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    });

    it.each(['b', 'c'])('keeps the %s API disabled by default and secures explicitly enabled dashboards', async prefix => {
        const app = createTestApp();
        const code = await createLink(app);
        const disabled = await app.request(`${ORIGIN}/${prefix}/${code}`);
        const text = await disabled.text();
        const config = prefix === 'b' ? JSON.parse(text) : yaml.load(text);
        expect(prefix === 'b' ? config.experimental?.clash_api : config['external-controller']).toBeUndefined();
        const type = prefix === 'b' ? 'singbox' : 'clash';
        const enabled = await app.request(`${ORIGIN}/${type}?${new URLSearchParams({ config: NODE, enable_clash_ui: 'true' })}`);
        const body = await enabled.text();
        const result = prefix === 'b' ? JSON.parse(body).experimental.clash_api : yaml.load(body);
        expect(result[prefix === 'b' ? 'external_controller' : 'external-controller']).toBe('127.0.0.1:9090');
        expect(result.secret).toMatch(/^[A-Za-z0-9]{32}$/);
    });

    it('rejects oversized upstream content without logging its URL or token', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('small', { headers: { 'content-length': String(3 * 1024 * 1024) } }));
        expect(await fetchSubscriptionWithFormat('https://provider.example/sub?token=SECRET')).toBeNull();
        expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET');
    });
});
