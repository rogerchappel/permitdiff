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

test('parses YAML block and flow sequences without losing values', async () => {
  const content = await readFile(path.join(repoRoot, 'fixtures/sequence-policy.yaml'), 'utf8');
  const policy = parseYamlPolicy(content, 'fixtures/sequence-policy.yaml');

  assert.deepEqual(policy.entries, [
    { kind: 'command', effect: 'allow', value: 'npm test', source: 'fixtures/sequence-policy.yaml' },
    { kind: 'command', effect: 'allow', value: 'git status', source: 'fixtures/sequence-policy.yaml' },
    { kind: 'path', effect: 'allow', value: 'docs/#draft.md', source: 'fixtures/sequence-policy.yaml' },
    { kind: 'domain', effect: 'deny', value: 'metadata.google.internal', source: 'fixtures/sequence-policy.yaml' }
  ]);
});

test('rejects malformed and unsupported YAML policies with source context', () => {
  assert.throws(
    () => parseYamlPolicy('allow: [unterminated', 'broken.yaml'),
    /Invalid YAML policy in broken\.yaml:/
  );
  assert.throws(
    () => parseYamlPolicy('allow:\n  commands: npm test\n', 'scalar.yaml'),
    /Unsupported YAML policy in scalar\.yaml: "allow\.commands" must be a block or flow sequence/
  );
  assert.throws(
    () => parseYamlPolicy('allow:\n  capabilities: [deploy]\n', 'unknown.yaml'),
    /Unsupported YAML policy in unknown\.yaml: unsupported permission kind "capabilities"/
  );
});

test('rejects malformed and unsupported JSON policies with source context', () => {
  const unsupported = [
    ['null', 'expected a top-level object or entry array'],
    ['"allow"', 'expected a top-level object or entry array'],
    ['42', 'expected a top-level object or entry array'],
    ['{"allows":{"commands":["npm test"]}}', 'unsupported top-level key "allows"'],
    ['{"allow":[]}', '"allow" must be a mapping of permission kinds to arrays'],
    ['{"allow":{"capabilities":["deploy"]}}', 'unsupported permission kind "capabilities" in "allow"'],
    ['{"allow":{"commands":"npm test"}}', '"allow.commands" must be an array'],
    ['{"deny":{"domains":[false]}}', '"deny.domains" must contain only strings'],
    ['{"entries":["npm test"]}', 'entry at index 0 must be an object'],
    ['{"entries":[{"kind":"command","effect":"permit","value":"npm test"}]}', 'entry at index 0 unsupported effect "permit"'],
    ['{"entries":[{"kind":"capability","value":"deploy"}]}', 'entry at index 0 unsupported kind "capability"'],
    ['{"entries":[{"kind":"command","value":7}]}', 'entry at index 0 must have a string value']
  ] as const;

  for (const [content, detail] of unsupported) {
    assert.throws(
      () => parseJsonPolicy(content, 'policy.json'),
      (error: unknown) => error instanceof Error
        && error.message === `Unsupported JSON policy in policy.json: ${detail}`
    );
  }

  assert.throws(
    () => parseJsonPolicy('{"allow":', 'broken.json'),
    /Invalid JSON policy in broken\.json:/
  );
});

test('accepts documented JSON section and entry-array forms', () => {
  const sections = parseJsonPolicy('{"allow":{"commands":["npm test"]},"deny":{"domains":["example.com"]}}');
  const entries = parseJsonPolicy('{"entries":[{"kind":"tool","effect":"deny","value":"write"},{"kind":"path","value":"/tmp/"}]}');
  const topLevelEntries = parseJsonPolicy('[{"kind":"domain","value":"API.GitHub.com"}]');

  assert.deepEqual(sections.entries.map(({ kind, effect, value }) => ({ kind, effect, value })), [
    { kind: 'command', effect: 'allow', value: 'npm test' },
    { kind: 'domain', effect: 'deny', value: 'example.com' }
  ]);
  assert.deepEqual(entries.entries.map(({ kind, effect, value }) => ({ kind, effect, value })), [
    { kind: 'tool', effect: 'deny', value: 'write' },
    { kind: 'path', effect: 'allow', value: '/tmp' }
  ]);
  assert.equal(topLevelEntries.entries[0]?.value, 'api.github.com');
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
