import { readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parsePolicyFile } from './parse.js';
import type { PermissionEntry, Policy } from './types.js';

const SUPPORTED_EXTENSIONS = new Set(['.json', '.md', '.markdown', '.yaml', '.yml']);

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
    } else if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files.sort();
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

