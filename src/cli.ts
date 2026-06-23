#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diffPolicies } from './core/diff.js';
import { parsePolicyFile } from './core/parse.js';
import { scanWorkspace, writePolicyJson } from './core/scan.js';
import { formatJson } from './output/json.js';
import { formatMarkdown } from './output/markdown.js';

type Format = 'json' | 'markdown';

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (command === 'compare') {
      await runCompare(rest);
      return 0;
    }
    if (command === 'scan') {
      await runScan(rest);
      return 0;
    }
    printHelp();
    return command ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function runCompare(args: string[]): Promise<void> {
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const basePath = positional[0];
  const currentPath = positional[1];
  if (!basePath || !currentPath) {
    throw new Error('compare requires <base> and <current> policy files.');
  }
  const format = readFormat(args);
  const base = await parsePolicyFile(basePath);
  const current = await parsePolicyFile(currentPath);
  const result = diffPolicies(base, current);
  process.stdout.write(format === 'json' ? formatJson(result) : formatMarkdown(result));
}

async function runScan(args: string[]): Promise<void> {
  const root = args.find((arg) => !arg.startsWith('--'));
  if (!root) {
    throw new Error('scan requires <workspace> path.');
  }
  const out = readOption(args, '--out');
  const policy = await scanWorkspace(root);
  const body = `${JSON.stringify({ entries: policy.entries }, null, 2)}\n`;
  if (out) {
    await mkdir(path.dirname(out), { recursive: true });
    await writePolicyJson(policy, out);
  } else {
    process.stdout.write(body);
  }
}

function readFormat(args: string[]): Format {
  const value = readOption(args, '--format') ?? 'json';
  if (value !== 'json' && value !== 'markdown') {
    throw new Error(`Unsupported format: ${value}`);
  }
  return value;
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function printHelp(): void {
  process.stdout.write(`permitdiff\n\nUsage:\n  permitdiff compare <base> <current> --format json|markdown\n  permitdiff scan <workspace> --out policy.json\n`);
}

const invokedPath = process.argv[1];
if (invokedPath && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(invokedPath)) {
  const exitCode = await main();
  process.exit(exitCode);
}
