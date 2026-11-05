import { CloudflareKVAdapter } from '../adapters/kv/cloudflareKv.js';
import { createShortLinkRevocations } from '../services/shortLinkRevocations.js';

export function createCloudflareRuntime(env) {
    return {
        kv: env?.SUBLINK_KV ? new CloudflareKVAdapter(env.SUBLINK_KV) : null,
        assetFetcher: env?.ASSETS ? (request) => env.ASSETS.fetch(request) : null,
        logger: console,
        shortLinkRevocations: env?.SHORT_LINK_REVOCATIONS ? createShortLinkRevocations(env.SHORT_LINK_REVOCATIONS) : undefined,
        clientIp: request => request.headers.get('CF-Connecting-IP'),
        rateLimit: env?.READ_LIMITER && env?.WRITE_LIMITER ? async (key, writing) => {
            const limiter = writing ? env.WRITE_LIMITER : env.READ_LIMITER;
            return (await limiter.limit({ key })).success;
        } : undefined,
        config: {
            configTtlSeconds: parseTtl(env?.CONFIG_TTL_SECONDS),
            shortLinkTtlSeconds: parseTtl(env?.SHORT_LINK_TTL_SECONDS)
        }
    };
}

function parseTtl(value) {
    if (value === undefined || value === '') return undefined;
    const ttl = Number(value);
    return Number.isInteger(ttl) && (ttl === 0 || ttl >= 60) ? ttl : undefined;
}
