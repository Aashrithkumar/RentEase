import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpath, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const backendRoot = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const output = resolve(backendRoot, 'dist');
if (dirname(output) !== backendRoot) throw new Error('Build output must stay inside the backend directory.');
try {
  const resolvedOutput = await realpath(output);
  if (resolvedOutput.toLowerCase() !== output.toLowerCase()) throw new Error('Refusing to clean a linked build directory outside the backend.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await rm(output, { recursive: true, force: true });
const require = createRequire(import.meta.url);
const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc')], { cwd: backendRoot, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
