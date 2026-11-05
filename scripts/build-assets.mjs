import { mkdir, copyFile, cp, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { transform } from 'esbuild';
import config from '../tailwind.config.cjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'public', 'assets');
await mkdir(output, { recursive: true });

// Ship reviewed, locked dependencies with the app instead of executing CDN responses.
const css = await postcss([tailwindcss(config)]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
await writeFile(path.join(output, 'app.css'), (await transform(css.css, { loader: 'css', minify: true })).code);
await copyFile(path.join(root, 'node_modules/alpinejs/dist/cdn.min.js'), path.join(output, 'alpine.min.js'));
await copyFile(path.join(root, 'node_modules/js-yaml/dist/js-yaml.min.js'), path.join(output, 'js-yaml.min.js'));
const icons = path.join(root, 'node_modules/@fortawesome/fontawesome-free');
await mkdir(path.join(output, 'fontawesome', 'css'), { recursive: true });
await copyFile(path.join(icons, 'css', 'all.min.css'), path.join(output, 'fontawesome', 'css', 'all.min.css'));
await cp(path.join(icons, 'webfonts'), path.join(output, 'fontawesome', 'webfonts'), { recursive: true });
await copyFile(path.join(root, 'scripts/licenses/alpine-LICENSE.md'), path.join(output, 'alpine-LICENSE.md'));
for (const [source, target] of [
    ['js-yaml/LICENSE', 'js-yaml-LICENSE'],
    ['@fortawesome/fontawesome-free/LICENSE.txt', 'fontawesome-LICENSE.txt']
]) await copyFile(path.join(root, 'node_modules', source), path.join(output, target));
console.log('Built local CSS, scripts, and icon fonts in public/assets');
