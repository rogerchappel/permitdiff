# PermitDiff PRD

Status: in-progress

## Summary

PermitDiff compares tool, command, and network permission files for agent workspaces. It highlights newly broadened access, removed safety boundaries, and mismatched policy between local templates and live workspaces.

## Problem

Agent workspaces accumulate permission files in JSON, YAML, and Markdown. Reviewers need to know when a change grants broader command, filesystem, or network access. Generic text diff is noisy and misses semantic risk.

## V1 Scope

- Parse JSON permission manifests and Markdown allow/deny lists.
- Normalize commands, path prefixes, domains, and named tools into a common model.
- Diff two policies and classify additions, removals, and widened scopes.
- Emit JSON and human-readable Markdown.
- Ship fixture-backed tests with risky and benign examples.

## Non-Goals

- Enforcing permissions at runtime.
- Secret scanning.
- SaaS policy management.

## CLI

```bash
permitdiff compare base.json current.json --format markdown
permitdiff scan ./fixtures/workspace --out policy.json
```

## Source Attribution

Inspired by Open Policy Agent-style policy review and agent permission manifests, reframed as a tiny reviewer CLI for local agent workspaces.
