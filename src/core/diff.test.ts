import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { diffPolicies } from './diff.js';
import { parseJsonPolicy, parseJsonPolicyFile } from './json.js';
import { parseMarkdownPolicy } from './markdown.js';
import { scanWorkspace, writePolicyJson } from './scan.js';
import { parseYamlPolicy } from './yaml.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('parses json, markdown, and yaml policies into normalized entries', () => {
  const json = parseJsonPolicy(JSON.stringify({
    allow: {
      commands: ['npm   test'],
      domains: ['https://API.GitHub.com/repos']
    },
    deny: {
      paths: ['C:\\workspace\\secret\\']
    }
  }));
  const markdown = parseMarkdownPolicy('## Allow Tools\n\n- `Read`\n\n## Deny Commands\n\n- `rm -rf *`\n');
  const yaml = parseYamlPolicy('allow:\n  paths:\n    - /workspace/project/src/\n');

  assert.deepEqual(json.entries.map((entry) => entry.value), [
    'npm test',
    'api.github.com',
    'C:/workspace/secret'
  ]);
  assert.deepEqual(markdown.entries, [
    { kind: 'tool', effect: 'allow', value: 'read', source: '<markdown>' },
    { kind: 'command', effect: 'deny', value: 'rm -rf *', source: '<markdown>' }
  ]);
  assert.equal(yaml.entries[0]?.value, '/workspace/project/src');
});

test('classifies broadened allows and removed denies as high risk', async () => {
  const base = await parseJsonPolicyFile(path.join(repoRoot, 'fixtures/base-policy.json'));
  const current = await parseJsonPolicyFile(path.join(repoRoot, 'fixtures/current-policy.json'));
  const result = diffPolicies(base, current);

  assert.equal(result.summary.highRisk, 5);
  assert.ok(result.changes.some((change) => {
    return change.type === 'added'
      && change.kind === 'command'
      && change.value === 'npm *'
      && change.classification === 'widened';
  }));
  assert.ok(result.changes.some((change) => {
    return change.type === 'removed'
      && change.kind === 'command'
      && change.effect === 'deny'
      && change.classification === 'boundary-removed';
  }));
});

test('scans a workspace and writes a deduped policy json file', async () => {
  const policy = await scanWorkspace(path.join(repoRoot, 'fixtures/workspace'));
  const outDir = await mkdtemp(path.join(tmpdir(), 'permitdiff-'));
  const outPath = path.join(outDir, 'policy.json');

  try {
    await writePolicyJson(policy, outPath);
    const written = JSON.parse(await readFile(outPath, 'utf8')) as { entries: unknown[] };

    assert.equal(policy.entries.length, 7);
    assert.equal(written.entries.length, 7);
    assert.ok(policy.entries.some((entry) => entry.kind === 'domain' && entry.effect === 'deny'));
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
