import { readFile } from 'fs/promises';
import path from 'path';

const MIME_TYPES = {
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.json': 'application/json',
    '.txt': 'text/plain'
};

export function createFileAssetFetcher(rootDirectory = 'public') {
    const root = path.resolve(rootDirectory);
    return async (request) => {
        const url = new URL(request.url);
        let relativePath = url.pathname === '/' ? '/index.html' : url.pathname;
        relativePath = relativePath.replace(/^\/+/, '');
        const targetPath = path.resolve(root, relativePath);

        const relativeTarget = path.relative(root, targetPath);
        if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
            return new Response('Not found', { status: 404 });
        }

        try {
            const fileBuffer = await readFile(targetPath);
            const extension = path.extname(targetPath).toLowerCase();
            const contentType = MIME_TYPES[extension] || 'application/octet-stream';
            return new Response(fileBuffer, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=86400'
                }
            });
        } catch {
            return new Response('Not found', { status: 404 });
        }
    };
}
