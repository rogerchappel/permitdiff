import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function runCli(...args: string[]) {
  return spawnSync(process.execPath, ['dist/cli.js', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

test('compare accepts options before and after its policy paths', () => {
  const paths = ['fixtures/base-policy.json', 'fixtures/current-policy.json'];
  const trailing = runCli('compare', ...paths, '--format', 'markdown');
  const leading = runCli('compare', '--format', 'markdown', ...paths);

  assert.equal(trailing.status, 0, trailing.stderr);
  assert.equal(leading.status, 0, leading.stderr);
  assert.equal(leading.stdout, trailing.stdout);
  assert.match(leading.stdout, /^# Permission Diff/m);
});

test('scan accepts --out before and after its workspace path', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'permitdiff-cli-'));
  const trailingPath = path.join(directory, 'trailing.json');
  const leadingPath = path.join(directory, 'leading.json');
  const trailing = runCli('scan', 'fixtures/workspace', '--out', trailingPath);
  const leading = runCli('scan', '--out', leadingPath, 'fixtures/workspace');

  assert.equal(trailing.status, 0, trailing.stderr);
  assert.equal(leading.status, 0, leading.stderr);
  assert.deepEqual(
    JSON.parse(readFileSync(leadingPath, 'utf8')),
    JSON.parse(readFileSync(trailingPath, 'utf8')),
  );
});

const invalidInvocations = [
  {
    name: 'missing compare option value',
    args: ['compare', 'fixtures/base-policy.json', 'fixtures/current-policy.json', '--format'],
    error: '--format requires a value.',
  },
  {
    name: 'missing scan option value',
    args: ['scan', 'fixtures/workspace', '--out'],
    error: '--out requires a value.',
  },
  {
    name: 'unknown compare option',
    args: ['compare', '--pretty', 'fixtures/base-policy.json', 'fixtures/current-policy.json'],
    error: 'Unknown option for compare: --pretty',
  },
  {
    name: 'unknown scan option',
    args: ['scan', '--format', 'json', 'fixtures/workspace'],
    error: 'Unknown option for scan: --format',
  },
  {
    name: 'surplus compare positional',
    args: ['compare', 'fixtures/base-policy.json', 'fixtures/current-policy.json', 'extra.json'],
    error: 'compare accepts exactly <base> and <current> policy files.',
  },
  {
    name: 'surplus scan positional',
    args: ['scan', 'fixtures/workspace', 'another-workspace'],
    error: 'scan accepts exactly one <workspace> path.',
  },
] satisfies Array<{ name: string; args: string[]; error: string }>;

for (const invocation of invalidInvocations) {
  test(`rejects ${invocation.name}`, () => {
    const result = runCli(...invocation.args);

    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(invocation.error.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
}
