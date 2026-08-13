import { readFile } from 'node:fs/promises';
import { normalizeEffect, normalizeEntry, normalizeKind } from './normalize.js';
import type { PermissionEffect, PermissionEntry, PermissionKind, Policy } from './types.js';

const headingPattern = /^#{1,6}\s+(allow|allowed|deny|denied|blocked|block)?\s*([a-z -]+)\s*$/i;
const bulletPattern = /^\s*[-*]\s+(?:\[(allow|deny|allowed|denied|block|blocked)\]\s+)?(?:([a-z]+):\s*)?(.+?)\s*$/i;

export async function parseMarkdownPolicyFile(filePath: string): Promise<Policy> {
  const content = await readFile(filePath, 'utf8');
  return parseMarkdownPolicy(content, filePath);
}

export function parseMarkdownPolicy(content: string, source = '<markdown>'): Policy {
  const entries: PermissionEntry[] = [];
  let currentEffect: PermissionEffect | undefined;
  let currentKind: PermissionKind | undefined;

  for (const rawLine of content.split(/\r?\n/)) {
    const heading = headingPattern.exec(rawLine);
    if (heading) {
      currentEffect = heading[1] ? normalizeEffect(heading[1]) : currentEffect;
      const headingKind = heading[2];
      currentKind = headingKind ? normalizeKind(headingKind.replace(/\s+list$/i, '')) : undefined;
      continue;
    }

    const bullet = bulletPattern.exec(rawLine);
    if (!bullet) {
      continue;
    }

    const effect = bullet[1] ? normalizeEffect(bullet[1]) : currentEffect;
    const kind = bullet[2] ? normalizeKind(bullet[2]) : currentKind;
    const value = bullet[3] ? cleanupMarkdownValue(bullet[3]) : undefined;

    if (effect && kind && value) {
      entries.push(normalizeEntry({ kind, effect, value, source }));
    }
  }

  return { source, entries };
}

function cleanupMarkdownValue(value: string): string {
  const trimmed = value.trim();
  const codeSpan = /^(`+)([\s\S]*?)\1(?:\s+#.*)?$/.exec(trimmed);

  if (codeSpan) {
    return codeSpan[2]?.trim() ?? '';
  }

  return trimmed.replace(/\s+#.*$/, '').trim();
}
