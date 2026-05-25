import type { DiffChange, DiffResult } from '../core/types.js';

export function formatMarkdown(result: DiffResult): string {
  const lines = [
    '# PermitDiff Report',
    '',
    `- Added: ${result.summary.added}`,
    `- Removed: ${result.summary.removed}`,
    `- Unchanged: ${result.summary.unchanged}`,
    `- High risk: ${result.summary.highRisk}`,
    '',
    '## Changes',
    ''
  ];

  if (result.changes.length === 0) {
    lines.push('No permission differences found.', '');
    return lines.join('\n');
  }

  for (const change of result.changes) {
    lines.push(`- **${change.risk.toUpperCase()}** ${label(change)}: \`${change.value}\``);
    lines.push(`  - ${change.reason}`);
    if (change.related) {
      lines.push(`  - Related: \`${change.related}\``);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function label(change: DiffChange): string {
  return `${change.type} ${change.effect} ${change.kind} (${change.classification})`;
}

