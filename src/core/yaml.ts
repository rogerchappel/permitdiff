import { readFile } from 'node:fs/promises';
import { parseJsonPolicy } from './json.js';
import type { Policy } from './types.js';

export async function parseYamlPolicyFile(filePath: string): Promise<Policy> {
  const content = await readFile(filePath, 'utf8');
  return parseYamlPolicy(content, filePath);
}

export function parseYamlPolicy(content: string, source = '<yaml>'): Policy {
  const jsonLike: Record<string, Record<string, string[]>> = {};
  let section: string | undefined;
  let key: string | undefined;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/g, '');
    if (!line.trim()) {
      continue;
    }
    const sectionMatch = /^([A-Za-z][\w-]*):\s*$/.exec(line);
    if (sectionMatch?.[1]) {
      section = sectionMatch[1].toLowerCase();
      jsonLike[section] ??= {};
      key = undefined;
      continue;
    }
    const keyMatch = /^\s{2}([A-Za-z][\w-]*):\s*$/.exec(line);
    if (section && keyMatch?.[1]) {
      key = keyMatch[1].toLowerCase();
      const sectionRecord = jsonLike[section] ??= {};
      sectionRecord[key] ??= [];
      continue;
    }
    const itemMatch = /^\s{4}-\s+(.+?)\s*$/.exec(line);
    if (section && key && itemMatch?.[1]) {
      const sectionRecord = jsonLike[section] ??= {};
      const items = sectionRecord[key] ??= [];
      items.push(itemMatch[1].replace(/^['"]|['"]$/g, ''));
    }
  }

  return parseJsonPolicy(JSON.stringify(jsonLike), source);
}
