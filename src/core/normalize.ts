import type { PermissionEffect, PermissionEntry, PermissionKind } from './types.js';

const KIND_ALIASES: Record<string, PermissionKind> = {
  command: 'command',
  commands: 'command',
  cmd: 'command',
  path: 'path',
  paths: 'path',
  filesystem: 'path',
  fs: 'path',
  domain: 'domain',
  domains: 'domain',
  network: 'domain',
  host: 'domain',
  hosts: 'domain',
  tool: 'tool',
  tools: 'tool'
};

export function normalizeKind(value: string): PermissionKind | undefined {
  return KIND_ALIASES[value.trim().toLowerCase()];
}

export function normalizeEffect(value: string): PermissionEffect | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'allow' || normalized === 'allowed') {
    return 'allow';
  }
  if (normalized === 'deny' || normalized === 'denied' || normalized === 'block' || normalized === 'blocked') {
    return 'deny';
  }
  return undefined;
}

export function normalizeValue(kind: PermissionKind, rawValue: string): string {
  const trimmed = rawValue.trim().replace(/^`|`$/g, '');
  switch (kind) {
    case 'command':
      return normalizeCommand(trimmed);
    case 'path':
      return normalizePath(trimmed);
    case 'domain':
      return normalizeDomain(trimmed);
    case 'tool':
      return trimmed.toLowerCase();
  }
}

export function normalizeEntry(entry: PermissionEntry): PermissionEntry {
  return {
    ...entry,
    value: normalizeValue(entry.kind, entry.value)
  };
}

export function entryKey(entry: Pick<PermissionEntry, 'kind' | 'effect' | 'value'>): string {
  return `${entry.kind}:${entry.effect}:${entry.value}`;
}

function normalizeCommand(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizePath(value: string): string {
  if (value === '/') {
    return value;
  }
  return value.replace(/\\/g, '/').replace(/\/+$/g, '');
}

function normalizeDomain(value: string): string {
  return value
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/g, '')
    .replace(/:\d+$/g, '')
    .toLowerCase();
}

