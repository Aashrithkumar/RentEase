import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

// Generate routing from the actual Render URL, without a hardcoded service name.
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let apiOrigin;
try {
  const url = new URL(process.env.RENDER_API_URL || '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Use an HTTPS origin without a path, credentials or query.');
  }
  apiOrigin = url.origin;
} catch {
  throw new Error('Set RENDER_API_URL to your backend origin, for example https://your-service.onrender.com (without /api/v1).');
}
if (process.env.VITE_API_URL && process.env.VITE_API_URL !== '/api/v1') {
  throw new Error('Set VITE_API_URL=/api/v1 or remove it. Vercel forwards /api requests to Render.');
}
for (const [entry, args] of [
  [require.resolve('typescript/bin/tsc'), ['-b']],
  [resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js'), ['build']],
]) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd: project, stdio: 'inherit', env: { ...process.env, VITE_API_URL: '/api/v1' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const output = resolve(project, '.vercel', 'output');
// The only directory removed is this frontend's generated deployment output.
if (dirname(output) !== resolve(project, '.vercel')) throw new Error('Invalid output path.');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(project, 'dist'), resolve(output, 'static'), { recursive: true });
await writeFile(resolve(output, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    {
      src: '^/api/(.*)$', dest: `${apiOrigin}/api/$1`,
      headers: { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store', 'x-vercel-enable-rewrite-caching': '0' },
    },
    { handle: 'filesystem' },
    { src: '^/(?!api(?:/|$)|assets(?:/|$)).*$', dest: '/index.html' },
  ],
}, null, 2) + '\n');
console.log('Vercel output ready: static frontend, Render API proxy, and page-route fallback.');
