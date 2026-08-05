import { readFile } from 'node:fs/promises';
import { normalizeEntry, normalizeEffect, normalizeKind, normalizeValue } from './normalize.js';
import type { PermissionEffect, PermissionEntry, PermissionKind, Policy } from './types.js';

type JsonRecord = Record<string, unknown>;

export async function parseJsonPolicyFile(filePath: string): Promise<Policy> {
  const content = await readFile(filePath, 'utf8');
  return parseJsonPolicy(content, filePath);
}

export function parseJsonPolicy(content: string, source = '<json>'): Policy {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON policy in ${source}: ${errorMessage(error)}`, { cause: error });
  }
  const entries: PermissionEntry[] = [];

  if (Array.isArray(parsed)) {
    entries.push(...parseJsonEntryArray(parsed, source));
  } else if (isRecord(parsed)) {
    entries.push(...parseJsonObject(parsed, source));
  } else {
    throw schemaError(source, 'expected a top-level object or entry array');
  }

  return { source, entries: entries.map(normalizeEntry) };
}

function parseJsonObject(record: JsonRecord, source: string): PermissionEntry[] {
  const entries: PermissionEntry[] = [];

  for (const key of Object.keys(record)) {
    if (key !== 'allow' && key !== 'deny' && key !== 'entries') {
      throw schemaError(source, `unsupported top-level key "${key}"`);
    }
  }

  if (Object.keys(record).length === 0) {
    throw schemaError(source, 'expected at least one allow, deny, or entries section');
  }

  for (const effectName of ['allow', 'deny'] as const) {
    if (!(effectName in record)) continue;
    const section = record[effectName];
    if (!isRecord(section)) {
      throw schemaError(source, `"${effectName}" must be a mapping of permission kinds to arrays`);
    }
    entries.push(...parseKindBuckets(section, effectName, source));
  }

  if ('entries' in record) {
    if (!Array.isArray(record.entries)) {
      throw schemaError(source, '"entries" must be an array of permission entries');
    }
    entries.push(...parseJsonEntryArray(record.entries, source));
  }

  return dedupe(entries);
}

function parseKindBuckets(record: JsonRecord, defaultEffect: PermissionEffect, source: string): PermissionEntry[] {
  const entries: PermissionEntry[] = [];
  for (const [key, value] of Object.entries(record)) {
    const kind = normalizeKind(key);
    if (!kind) {
      throw schemaError(source, `unsupported permission kind "${key}" in "${defaultEffect}"`);
    }
    if (!Array.isArray(value)) {
      throw schemaError(source, `"${defaultEffect}.${key}" must be an array`);
    }
    if (value.some((item) => typeof item !== 'string')) {
      throw schemaError(source, `"${defaultEffect}.${key}" must contain only strings`);
    }
    for (const item of value) {
      entries.push({ kind, effect: defaultEffect, value: normalizeValue(kind, item as string), source });
    }
  }
  return entries;
}

function parseJsonEntryArray(items: unknown[], source: string): PermissionEntry[] {
  const entries: PermissionEntry[] = [];
  for (const [index, item] of items.entries()) {
    if (!isRecord(item)) {
      throw schemaError(source, `entry at index ${index} must be an object`);
    }
    for (const key of Object.keys(item)) {
      if (key !== 'kind' && key !== 'effect' && key !== 'value' && key !== 'source') {
        throw schemaError(source, `entry at index ${index} has unsupported key "${key}"`);
      }
    }
    if (typeof item.kind !== 'string' || !normalizeKind(item.kind)) {
      const detail = typeof item.kind === 'string' ? `unsupported kind "${item.kind}"` : 'must have a string kind';
      throw schemaError(source, `entry at index ${index} ${detail}`);
    }
    const kind = normalizeKind(item.kind)!;
    const effect = item.effect === undefined
      ? 'allow'
      : typeof item.effect === 'string' ? normalizeEffect(item.effect) : undefined;
    if (!effect) {
      const detail = typeof item.effect === 'string' ? `unsupported effect "${item.effect}"` : 'must have a string effect';
      throw schemaError(source, `entry at index ${index} ${detail}`);
    }
    if (typeof item.value !== 'string') {
      throw schemaError(source, `entry at index ${index} must have a string value`);
    }
    entries.push({ kind, effect, value: item.value, source });
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

function schemaError(source: string, detail: string): Error {
  return new Error(`Unsupported JSON policy in ${source}: ${detail}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
