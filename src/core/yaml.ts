import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { parseJsonPolicy } from './json.js';
import { normalizeKind } from './normalize.js';
import type { Policy } from './types.js';

export async function parseYamlPolicyFile(filePath: string): Promise<Policy> {
  const content = await readFile(filePath, 'utf8');
  return parseYamlPolicy(content, filePath);
}

export function parseYamlPolicy(content: string, source = '<yaml>'): Policy {
  let parsed: unknown;
  try {
    parsed = parse(content);
  } catch (error) {
    throw new Error(`Invalid YAML policy in ${source}: ${errorMessage(error)}`, { cause: error });
  }

  if (!isRecord(parsed)) {
    throw schemaError(source, 'expected a top-level mapping with allow and/or deny sections');
  }

  for (const [sectionName, section] of Object.entries(parsed)) {
    if (sectionName !== 'allow' && sectionName !== 'deny') {
      throw schemaError(source, `unsupported top-level key "${sectionName}"`);
    }
    if (!isRecord(section)) {
      throw schemaError(source, `"${sectionName}" must be a mapping of permission kinds to sequences`);
    }

    for (const [kindName, values] of Object.entries(section)) {
      if (!normalizeKind(kindName)) {
        throw schemaError(source, `unsupported permission kind "${kindName}" in "${sectionName}"`);
      }
      if (!Array.isArray(values)) {
        throw schemaError(source, `"${sectionName}.${kindName}" must be a block or flow sequence`);
      }
      if (values.some((value) => typeof value !== 'string')) {
        throw schemaError(source, `"${sectionName}.${kindName}" must contain only strings`);
      }
    }
  }

  return parseJsonPolicy(JSON.stringify(parsed), source);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function schemaError(source: string, detail: string): Error {
  return new Error(`Unsupported YAML policy in ${source}: ${detail}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
