const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/deploy.yml'), 'utf8').replace(/\r\n/g, '\n');
const [verification, afterBuild, deployment] = workflow.split(/^  (?:pages-build|deploy):\s*$/m);

test('pull requests verify all regressions and Blender before building Pages', () => {
  assert.match(workflow, /^  pull_request:\s*\n    branches: \[main\]$/m);
  assert.match(verification, /^  verify:\s*$/m);
  assert.match(verification, /node --test tools\/tests\/\*\.cjs/);
  assert.match(verification, /^  blender-smoke:$/m);
  assert.match(verification, /Install Blender/);
  assert.match(verification, /test_anime3d_blender_smoke\.py/);
  assert.ok(afterBuild, 'pages-build job must be separate from PR verification');
  assert.match(afterBuild, /^    needs: \[verify, blender-smoke\]$/m);
  assert.match(afterBuild, /^    if: github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'$/m);
  assert.ok(deployment, 'deploy job must be separate from build and upload');
  assert.match(deployment, /^    needs: \[pages-build\]$/m);
  assert.match(deployment, /^    if: github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'$/m);
  assert.match(deployment, /^    permissions:\n      contents: read\n      actions: read\n      pages: write\n      id-token: write$/m);
});

test('Pages build keeps OAuth injection and uploads an artifact before deployment', () => {
  assert.ok(afterBuild, 'pages-build job is missing');
  assert.match(afterBuild, /GOOGLE_OAUTH_CLIENT_ID: \$\{\{ vars\.GOOGLE_OAUTH_CLIENT_ID \}\}/);
  assert.match(afterBuild, /run: node tools\/build-site\.mjs/);
  assert.match(afterBuild, /uses: actions\/upload-pages-artifact@v3[\s\S]*?path: '_site'/);
  assert.ok(deployment, 'deploy job is missing');
  assert.match(deployment, /Wait for Pages artifact metadata/);
  assert.match(deployment, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(deployment, /actions\/runs\/\$\{\{ github\.run_id \}\}\/artifacts/);
  assert.match(deployment, /select\(\.name == "github-pages"/);
  assert.match(deployment, /uses: actions\/deploy-pages@v4/);
});
