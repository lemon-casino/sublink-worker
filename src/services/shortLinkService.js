import { generateWebPath } from '../utils.js';
import { InvalidPayloadError, MissingDependencyError, ServiceError } from './errors.js';

function isSubscriptionQuery(value) {
    return typeof value === 'string' && value.startsWith('?') &&
        value.length <= 512 * 1024 && Boolean(new URLSearchParams(value).get('config'));
}

export class ShortLinkService {
    constructor(kv, options = {}) {
        this.kv = kv;
        this.options = options;
        this.rotations = new Set();
    }

    ensureKv() {
        if (!this.kv) {
            throw new MissingDependencyError('Short link service requires a KV store');
        }
        return this.kv;
    }

    async createShortLink(queryString, providedCode, baseConfig) {
        const kv = this.ensureKv();
        if (providedCode !== undefined || !isSubscriptionQuery(queryString)) {
            throw new InvalidPayloadError('A valid subscription is required; custom short codes are disabled');
        }
        const ttl = this.options.shortLinkTtlSeconds;
        const putOptions = ttl ? { expirationTtl: ttl } : undefined;
        for (let attempt = 0; attempt < 3; attempt++) {
            const shortCode = generateWebPath();
            const key = `short:${shortCode}`;
            if (await kv.get(key) !== null) continue;
            if (await this.isRevoked(shortCode)) continue;
            if (baseConfig) {
                await kv.put(`short-config:${shortCode}`, JSON.stringify(baseConfig), putOptions);
                const params = new URLSearchParams(queryString);
                params.delete('configId');
                params.set('hasBaseConfig', 'true');
                queryString = `?${params}`;
            }
            // Callers never choose keys, so concurrent writes cannot target an existing link.
            try {
                await kv.put(key, queryString, putOptions);
            } catch (error) {
                if (baseConfig) await kv.delete(`short-config:${shortCode}`).catch(() => this.options.logger?.error?.('Unable to clean up a short-link snapshot'));
                throw error;
            }
            return shortCode;
        }
        throw new ServiceError('Unable to create a short link', 503);
    }

    async resolveShortCode(code) {
        const kv = this.ensureKv();
        if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(code)) return null;
        const stored = await kv.get(`short:${code}`) ?? await kv.get(code);
        // Legacy links remain readable without exposing JSON stored by the config service.
        return isSubscriptionQuery(stored) && !await this.isRevoked(code) ? stored : null;
    }

    async isRevoked(code) {
        if (this.options.revocations) return this.options.revocations.isRevoked(code);
        return await this.ensureKv().get(`revoked:${code}`) !== null;
    }

    async getBaseConfig(code) {
        const stored = await this.ensureKv().get(`short-config:${code}`);
        return stored ? JSON.parse(stored) : undefined;
    }

    async deleteShortLink(code) {
        if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(code)) {
            throw new InvalidPayloadError('Invalid short code');
        }
        const kv = this.ensureKv();
        const legacy = await kv.get(code);
        // Revoke before deleting: cached KV values must never resurrect a deleted link.
        if (this.options.revocations) await this.options.revocations.revoke(code);
        else await kv.put(`revoked:${code}`, '1');
        await kv.delete(`short:${code}`);
        await kv.delete(`short-config:${code}`);
        if (isSubscriptionQuery(legacy)) await kv.delete(code);
        return true;
    }

    async rotateShortLink(code) {
        if (this.rotations.has(code)) throw new ServiceError('Short link is being replaced', 409);
        this.rotations.add(code);
        let lease;
        let replacement;
        const revocations = this.options.revocations;
        try {
            const query = await this.resolveShortCode(code);
            if (!query) throw new ServiceError('Short link is invalid or expired', 404);
            if (revocations?.beginRotation) lease = await revocations.beginRotation(code);
            const params = new URLSearchParams(query);
            let baseConfig;
            if (params.get('hasBaseConfig') === 'true') {
                baseConfig = await this.getBaseConfig(code);
                if (!baseConfig) throw new ServiceError('Short-link configuration is unavailable', 503);
            } else if (params.has('configId')) {
                const id = params.get('configId');
                const content = await this.options.configStorage?.getConfigById(id);
                if (!content) throw new ServiceError('Short-link configuration is unavailable', 503);
                baseConfig = { type: id.split('_')[0], content };
            }
            replacement = await this.createShortLink(query, undefined, baseConfig);
            if (lease) await revocations.completeRotation(code, lease);
            else if (await this.isRevoked(code)) throw new ServiceError('Short link is no longer active', 410);
            await this.deleteShortLink(code);
            return replacement;
        } catch (error) {
            // A failed replacement must not leave an undisclosed second subscription active.
            if (replacement) await this.deleteShortLink(replacement).catch(() => this.options.logger?.error?.('Unable to clean up a failed replacement'));
            throw error;
        } finally {
            if (lease) await revocations.cancelRotation(code, lease).catch(() => this.options.logger?.error?.('Unable to release a replacement lease'));
            this.rotations.delete(code);
        }
    }
}
