import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '_site');
const config = await readFile(resolve(root, 'drive-config.js'), 'utf8');
const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || config.match(/clientId:\s*"([^"]*)"/)?.[1] || '';
if (!/^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(clientId)) {
  throw new Error('Set repository variable GOOGLE_OAUTH_CLIENT_ID to a Google OAuth Web Client ID before deploying.');
}
// Only this explicit allowlist can reach the public Pages artifact.
const files = ['index.html', 'catalog.js', 'tasks.js', 'designed.js', 'forge.js', 'drive-config.js', 'drive-storage.js', 'vendor'];
await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const file of files) await cp(resolve(root, file), resolve(output, file), { recursive: true });
await writeFile(resolve(output, 'drive-config.js'), config.replace(/clientId:\s*"[^"]*"/, `clientId: ${JSON.stringify(clientId)}`));
await writeFile(resolve(output, '.nojekyll'), '');
console.log('Built _site with Google login; asset packages and prompts are excluded.');
