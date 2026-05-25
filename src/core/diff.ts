import { entryKey } from './normalize.js';
import type { DiffChange, DiffResult, PermissionEntry, PermissionKind, Policy, RiskLevel, ScopeClassification } from './types.js';

export function diffPolicies(base: Policy, current: Policy): DiffResult {
  const baseMap = mapEntries(base.entries);
  const currentMap = mapEntries(current.entries);
  const changes: DiffChange[] = [];
  const replacedBaseKeys = new Set<string>();

  for (const [key, entry] of currentMap) {
    if (baseMap.has(key)) {
      changes.push(toChange('unchanged', entry, 'exact', 'Permission is unchanged.'));
      continue;
    }
    const related = findRelated(entry, base.entries);
    const classification = classifyAddition(entry, related);
    if (classification === 'widened' && related) {
      replacedBaseKeys.add(entryKey(related));
    }
    changes.push(toChange('added', entry, classification, explainAddition(entry, classification, related), related?.value));
  }

  for (const [key, entry] of baseMap) {
    if (currentMap.has(key) || replacedBaseKeys.has(key)) {
      continue;
    }
    const related = findRelated(entry, current.entries);
    const classification = entry.effect === 'deny' ? 'boundary-removed' : classifyRemoval(entry, related);
    changes.push(toChange('removed', entry, classification, explainRemoval(entry, classification, related), related?.value));
  }

  const summary = {
    added: changes.filter((change) => change.type === 'added').length,
    removed: changes.filter((change) => change.type === 'removed').length,
    unchanged: changes.filter((change) => change.type === 'unchanged').length,
    highRisk: changes.filter((change) => change.risk === 'high').length
  };

  return { summary, changes: changes.sort(sortChanges) };
}

function mapEntries(entries: PermissionEntry[]): Map<string, PermissionEntry> {
  return new Map(entries.map((entry) => [entryKey(entry), entry]));
}

function findRelated(entry: PermissionEntry, candidates: PermissionEntry[]): PermissionEntry | undefined {
  return candidates.find((candidate) => {
    return candidate.kind === entry.kind
      && candidate.effect === entry.effect
      && (isWider(entry.kind, entry.value, candidate.value) || isWider(entry.kind, candidate.value, entry.value));
  });
}

function classifyAddition(entry: PermissionEntry, related: PermissionEntry | undefined): ScopeClassification {
  if (entry.effect === 'deny') {
    return 'new';
  }
  if (related && isWider(entry.kind, entry.value, related.value)) {
    return 'widened';
  }
  return 'new';
}

function classifyRemoval(entry: PermissionEntry, related: PermissionEntry | undefined): ScopeClassification {
  if (related && isWider(entry.kind, related.value, entry.value)) {
    return 'widened';
  }
  return 'narrowed';
}

function toChange(
  type: DiffChange['type'],
  entry: PermissionEntry,
  classification: ScopeClassification,
  reason: string,
  related?: string
): DiffChange {
  return {
    type,
    kind: entry.kind,
    effect: entry.effect,
    value: entry.value,
    classification,
    risk: riskFor(type, entry, classification),
    reason,
    ...(related ? { related } : {})
  };
}

function riskFor(type: DiffChange['type'], entry: PermissionEntry, classification: ScopeClassification): RiskLevel {
  if (classification === 'boundary-removed' || classification === 'widened') {
    return 'high';
  }
  if (type === 'added' && entry.effect === 'allow') {
    return entry.kind === 'command' || entry.kind === 'path' ? 'high' : 'medium';
  }
  if (type === 'removed' && entry.effect === 'deny') {
    return 'high';
  }
  return 'low';
}

function explainAddition(entry: PermissionEntry, classification: ScopeClassification, related: PermissionEntry | undefined): string {
  if (classification === 'widened' && related) {
    return `Allowed ${entry.kind} scope is wider than ${related.value}.`;
  }
  if (entry.effect === 'deny') {
    return 'A new safety boundary was added.';
  }
  return `A new ${entry.kind} allow entry was added.`;
}

function explainRemoval(entry: PermissionEntry, classification: ScopeClassification, related: PermissionEntry | undefined): string {
  if (classification === 'boundary-removed') {
    return 'A deny entry was removed, which may remove a safety boundary.';
  }
  if (classification === 'widened' && related) {
    return `Removed narrower entry because current policy uses wider ${related.value}.`;
  }
  return `A ${entry.kind} ${entry.effect} entry was removed.`;
}

function isWider(kind: PermissionKind, candidate: string, baseline: string): boolean {
  if (candidate === baseline) {
    return false;
  }
  if (candidate === '*' || candidate === '**') {
    return true;
  }
  if (kind === 'path') {
    return baseline.startsWith(`${candidate}/`) || candidate === '/';
  }
  if (kind === 'domain') {
    return candidate.startsWith('*.') && baseline.endsWith(candidate.slice(1));
  }
  if (kind === 'command') {
    return candidate.endsWith(' *') && baseline.startsWith(candidate.slice(0, -2));
  }
  return false;
}

function sortChanges(left: DiffChange, right: DiffChange): number {
  const riskOrder: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };
  return riskOrder[left.risk] - riskOrder[right.risk]
    || left.kind.localeCompare(right.kind)
    || left.value.localeCompare(right.value);
}
