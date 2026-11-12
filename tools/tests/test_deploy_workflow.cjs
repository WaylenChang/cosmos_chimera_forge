const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/deploy.yml'), 'utf8');
const [verify, deploy] = workflow.split(/^  deploy:\s*$/m);

test('pull requests run every Node regression test before Pages deployment', () => {
  assert.match(workflow, /^  pull_request:\s*\n    branches: \[main\]$/m);
  assert.match(verify, /^  verify:\s*$/m);
  assert.match(verify, /node --test tools\/tests\/\*\.cjs/);
  assert.ok(deploy, 'deploy job must be separate from PR verification');
  assert.match(deploy, /^    needs: verify$/m);
  assert.match(deploy, /^    if: github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'$/m);
  assert.match(deploy, /^    permissions:\n      contents: read\n      pages: write\n      id-token: write$/m);
});

test('production deployment retains OAuth build and Pages upload steps', () => {
  assert.ok(deploy, 'deploy job is missing');
  assert.match(deploy, /GOOGLE_OAUTH_CLIENT_ID: \$\{\{ vars\.GOOGLE_OAUTH_CLIENT_ID \}\}/);
  assert.match(deploy, /run: node tools\/build-site\.mjs/);
  assert.match(deploy, /uses: actions\/upload-pages-artifact@v3[\s\S]*?path: '_site'/);
  assert.match(deploy, /uses: actions\/deploy-pages@v4/);
});
