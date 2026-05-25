import { readFile } from 'node:fs/promises';
import { normalizeEntry, normalizeEffect, normalizeKind, normalizeValue } from './normalize.js';
import type { PermissionEffect, PermissionEntry, PermissionKind, Policy } from './types.js';

type JsonRecord = Record<string, unknown>;

export async function parseJsonPolicyFile(filePath: string): Promise<Policy> {
  const content = await readFile(filePath, 'utf8');
  return parseJsonPolicy(content, filePath);
}

export function parseJsonPolicy(content: string, source = '<json>'): Policy {
  const parsed = JSON.parse(content) as unknown;
  const entries: PermissionEntry[] = [];

  if (Array.isArray(parsed)) {
    entries.push(...parseJsonEntryArray(parsed, source));
  } else if (isRecord(parsed)) {
    entries.push(...parseJsonObject(parsed, source));
  }

  return { source, entries: entries.map(normalizeEntry) };
}

function parseJsonObject(record: JsonRecord, source: string): PermissionEntry[] {
  const entries: PermissionEntry[] = [];

  for (const effectName of ['allow', 'deny'] as const) {
    const section = record[effectName] ?? record[`${effectName}s`];
    if (isRecord(section)) {
      entries.push(...parseKindBuckets(section, effectName, source));
    }
  }

  const permissions = record.permissions ?? record.entries;
  if (Array.isArray(permissions)) {
    entries.push(...parseJsonEntryArray(permissions, source));
  }

  entries.push(...parseKindBuckets(record, 'allow', source));
  return dedupe(entries);
}

function parseKindBuckets(record: JsonRecord, defaultEffect: PermissionEffect, source: string): PermissionEntry[] {
  const entries: PermissionEntry[] = [];
  for (const [key, value] of Object.entries(record)) {
    const kind = normalizeKind(key);
    if (!kind) {
      continue;
    }
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (typeof item === 'string') {
        entries.push({ kind, effect: defaultEffect, value: normalizeValue(kind, item), source });
      }
    }
  }
  return entries;
}

function parseJsonEntryArray(items: unknown[], source: string): PermissionEntry[] {
  const entries: PermissionEntry[] = [];
  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }
    const kind = typeof item.kind === 'string' ? normalizeKind(item.kind) : undefined;
    const effect = typeof item.effect === 'string' ? normalizeEffect(item.effect) : 'allow';
    const value = typeof item.value === 'string' ? item.value : undefined;
    if (kind && effect && value) {
      entries.push({ kind, effect, value, source });
    }
  }
  return entries;
}

function dedupe(entries: PermissionEntry[]): PermissionEntry[] {
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

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

