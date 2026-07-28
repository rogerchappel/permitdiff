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
  const { positional, options } = parseArgs('compare', args, ['--format']);
  if (positional.length !== 2) {
    throw new Error('compare accepts exactly <base> and <current> policy files.');
  }
  const [basePath, currentPath] = positional as [string, string];
  const format = readFormat(options.get('--format'));
  const base = await parsePolicyFile(basePath);
  const current = await parsePolicyFile(currentPath);
  const result = diffPolicies(base, current);
  process.stdout.write(format === 'json' ? formatJson(result) : formatMarkdown(result));
}

async function runScan(args: string[]): Promise<void> {
  const { positional, options } = parseArgs('scan', args, ['--out']);
  if (positional.length !== 1) {
    throw new Error('scan accepts exactly one <workspace> path.');
  }
  const [root] = positional as [string];
  const out = options.get('--out');
  const policy = await scanWorkspace(root);
  const body = `${JSON.stringify({ entries: policy.entries }, null, 2)}\n`;
  if (out) {
    await mkdir(path.dirname(out), { recursive: true });
    await writePolicyJson(policy, out);
  } else {
    process.stdout.write(body);
  }
}

function readFormat(value: string | undefined): Format {
  value ??= 'json';
  if (value !== 'json' && value !== 'markdown') {
    throw new Error(`Unsupported format: ${value}`);
  }
  return value;
}

function parseArgs(command: string, args: string[], allowedOptions: string[]) {
  const positional: string[] = [];
  const options = new Map<string, string>();

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (!argument.startsWith('--')) {
      positional.push(argument);
      continue;
    }
    if (!allowedOptions.includes(argument)) {
      throw new Error(`Unknown option for ${command}: ${argument}`);
    }
    if (options.has(argument)) {
      throw new Error(`Option may only be specified once: ${argument}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${argument} requires a value.`);
    }
    options.set(argument, value);
    index += 1;
  }

  return { positional, options };
}

function printHelp(): void {
  process.stdout.write(`permitdiff\n\nUsage:\n  permitdiff compare <base> <current> --format json|markdown\n  permitdiff scan <workspace> --out policy.json\n`);
}

const invokedPath = process.argv[1];
if (invokedPath && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(invokedPath)) {
  const exitCode = await main();
  process.exit(exitCode);
}
