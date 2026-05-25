import type { DiffResult } from '../core/types.js';

export function formatJson(result: DiffResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

