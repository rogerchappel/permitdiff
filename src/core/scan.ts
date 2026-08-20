import { readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parsePolicyFile } from './parse.js';
import type { PermissionEntry, Policy } from './types.js';

const SUPPORTED_EXTENSIONS = new Set(['.json', '.md', '.markdown', '.yaml', '.yml']);
const POLICY_NAME_SEGMENT = /(?:^|[-_.])(policy|permissions?)(?:[-_.]|$)/i;

export async function scanWorkspace(root: string): Promise<Policy> {
  const files = await collectPolicyFiles(root);
  const policies = await Promise.all(files.map((file) => parsePolicyFile(file)));
  const entries = dedupeEntries(policies.flatMap((policy) => policy.entries));
  return { source: root, entries };
}

export async function writePolicyJson(policy: Policy, outPath: string): Promise<void> {
  await writeFile(outPath, `${JSON.stringify({ entries: policy.entries }, null, 2)}\n`, 'utf8');
}

async function collectPolicyFiles(root: string): Promise<string[]> {
  const stats = await stat(root);
  if (stats.isFile()) {
    // Explicit inputs retain strict validation, even when their filename would
    // not be selected during workspace discovery.
    return SUPPORTED_EXTENSIONS.has(path.extname(root).toLowerCase()) ? [root] : [];
  }

  const files: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
      continue;
    }
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectPolicyFiles(fullPath));
    } else if (isPolicyCandidate(entry.name)) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function isPolicyCandidate(fileName: string): boolean {
  const extension = path.extname(fileName).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return false;
  }

  const stem = fileName.slice(0, -extension.length);
  return fileName.toLowerCase() === 'agents.md' || POLICY_NAME_SEGMENT.test(stem);
}

function dedupeEntries(entries: PermissionEntry[]): PermissionEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.kind}:${entry.effect}:${entry.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
