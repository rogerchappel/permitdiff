import path from 'node:path';
import { parseJsonPolicyFile } from './json.js';
import { parseMarkdownPolicyFile } from './markdown.js';
import { parseYamlPolicyFile } from './yaml.js';
import type { Policy } from './types.js';

export async function parsePolicyFile(filePath: string): Promise<Policy> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    return parseJsonPolicyFile(filePath);
  }
  if (ext === '.md' || ext === '.markdown') {
    return parseMarkdownPolicyFile(filePath);
  }
  if (ext === '.yaml' || ext === '.yml') {
    return parseYamlPolicyFile(filePath);
  }
  throw new Error(`Unsupported policy file type: ${filePath}`);
}

