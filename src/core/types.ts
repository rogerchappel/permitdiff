export type PermissionKind = 'command' | 'path' | 'domain' | 'tool';

export type PermissionEffect = 'allow' | 'deny';

export type RiskLevel = 'low' | 'medium' | 'high';

export type PermissionEntry = {
  kind: PermissionKind;
  effect: PermissionEffect;
  value: string;
  source: string;
};

export type Policy = {
  entries: PermissionEntry[];
  source: string;
};

export type DiffChangeType = 'added' | 'removed' | 'unchanged';

export type ScopeClassification = 'exact' | 'narrowed' | 'widened' | 'boundary-removed' | 'new';

export type DiffChange = {
  type: DiffChangeType;
  kind: PermissionKind;
  effect: PermissionEffect;
  value: string;
  risk: RiskLevel;
  classification: ScopeClassification;
  reason: string;
  related?: string;
};

export type DiffResult = {
  summary: {
    added: number;
    removed: number;
    unchanged: number;
    highRisk: number;
  };
  changes: DiffChange[];
};

