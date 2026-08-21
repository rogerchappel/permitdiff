import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function fixture(mutator) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'permitdiff-release-contract-'));
  fs.cpSync(path.join(root, 'package.json'), path.join(directory, 'package.json'));
  fs.cpSync(path.join(root, 'releasebox.config.json'), path.join(directory, 'releasebox.config.json'));
  fs.mkdirSync(path.join(directory, '.github', 'workflows'), { recursive: true });
  fs.cpSync(path.join(root, '.github', 'workflows', 'release.yml'), path.join(directory, '.github', 'workflows', 'release.yml'));
  mutator(directory);
  return directory;
}

function validate(directory) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'validate-release-readiness.mjs')], {
    cwd: directory,
    encoding: 'utf8',
  });
}

test('accepts the repository release contract', () => {
  const result = validate(root);
  assert.equal(result.status, 0, result.stderr);
});

test('rejects disabled npm publication', (t) => {
  const directory = fixture((fixtureRoot) => {
    const configPath = path.join(fixtureRoot, 'releasebox.config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.release.publishNpm = false;
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const result = validate(directory);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must enable npm publication/);
});

for (const requiredScript of ['release:readiness', 'release:contract']) {
  test(`rejects a release gate that omits ${requiredScript}`, (t) => {
    const directory = fixture((fixtureRoot) => {
      const packagePath = path.join(fixtureRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      packageJson.scripts['release:check'] = packageJson.scripts['release:check']
        .split(' && ')
        .filter((command) => command !== `npm run ${requiredScript}`)
        .join(' && ');
      fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
    });
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

    const result = validate(directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`must run npm run ${requiredScript}`));
  });
}

test('rejects publication ordered before identity validation', (t) => {
  const directory = fixture((fixtureRoot) => {
    const workflowPath = path.join(fixtureRoot, '.github', 'workflows', 'release.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    fs.writeFileSync(workflowPath, workflow.replace('      - name: Validate tag and package identity', '      - name: Premature npm publication\n        run: npm publish "${{ steps.package.outputs.tarball }}" --provenance --access public\n      - name: Validate tag and package identity'));
  });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const result = validate(directory);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /publish the validated tarball after validation/);
});
