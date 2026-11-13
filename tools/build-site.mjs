import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '_site');
const config = await readFile(resolve(root, 'drive-config.js'), 'utf8');
const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || config.match(/clientId:\s*"([^"]*)"/)?.[1] || '';
if (!/^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(clientId)) {
  throw new Error('Set repository variable GOOGLE_OAUTH_CLIENT_ID to a Google OAuth Web Client ID before deploying.');
}
// Only this explicit allowlist can reach the public Pages artifact.
const files = ['index.html', 'catalog.js', 'tasks.js', 'designed.js', 'forge.js', 'model-review.js', 'drive-config.js', 'drive-storage.js', 'drive-cache.js', 'settings.js', 'pipeline.js', 'wiki.js', 'task-flow.js', 'anatomy-profiles.js', 'vendor'];
await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const file of files) await cp(resolve(root, file), resolve(output, file), { recursive: true });
await writeFile(resolve(output, 'drive-config.js'), config.replace(/clientId:\s*"[^"]*"/, `clientId: ${JSON.stringify(clientId)}`));
// Pages can cache scripts longer than the HTML between rapid deployments.
// Bind each shipped script/style URL to its actual output bytes.
let html = await readFile(resolve(output, 'index.html'), 'utf8');
const assets = new Set([...html.matchAll(/\b(?:src|href)="((?:vendor\/)?[\w.-]+\.(?:js|css))"/g)].map(match => match[1]));
for (const asset of assets) {
  const hash = createHash('sha256').update(await readFile(resolve(output, asset))).digest('hex').slice(0, 12);
  html = html.replaceAll(`="${asset}"`, `="${asset}?v=${hash}"`);
}
await writeFile(resolve(output, 'index.html'), html);
await writeFile(resolve(output, '.nojekyll'), '');
const forge = await readFile(resolve(root, 'forge.js'), 'utf8');
const catalog = await readFile(resolve(root, 'catalog.js'), 'utf8');
const tool = forge.match(/const TOOL_VERSION = "([^"]+)"/)?.[1] || 'unknown';
const catalogVersion = catalog.match(/version:\s*"([^"]+)"/)?.[1] || 'unknown';
const commit = process.env.GITHUB_SHA?.slice(0, 12) || 'local';
await writeFile(resolve(output, 'version.json'), JSON.stringify({tool,catalog:catalogVersion,commit},null,2)+'\n');
console.log('Built _site with Google login; asset packages and prompts are excluded.');
