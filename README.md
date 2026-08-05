# PermitDiff

Local-first CLI for comparing agent workspace permission policies.

## Status

This repository is early-stage. The MVP parses JSON, YAML, and Markdown policy
files, normalizes permission entries, and reports risky permission changes.

## Install

From a local checkout:

```sh
npm install
npm run build
```

## Use

Compare two policy files:

```sh
npx permitdiff compare fixtures/base-policy.json fixtures/current-policy.json --format markdown
```

Scan a workspace for supported policy files and write a normalized policy:

```sh
npx permitdiff scan fixtures/workspace --out policy.json
```

Command options may appear before or after positional paths. Each command
rejects unknown options, missing option values, and extra positional paths.

See [examples/permission-escalation.md](examples/permission-escalation.md) for a small escalation-review workflow using the bundled fixtures.

Supported policy inputs:

- JSON manifests with `allow` / `deny` sections or `entries` arrays
- YAML manifests with `allow` / `deny` sections
- Markdown headings such as `## Allow Commands` and bullet lists

YAML kind buckets accept block sequences and flow sequences. Values must be
strings, and supported kinds are commands, paths, domains, and tools (singular
or plural):

```yaml
allow:
  commands: ["npm test", "git status"]
  paths:
    - "docs/#draft.md"
deny:
  domains: [metadata.google.internal]
```

Malformed YAML, unknown sections or kinds, scalar buckets, and non-string
sequence values are rejected with an error that identifies the policy source.

JSON kind buckets likewise must be arrays of strings. The `entries` form uses
objects with a supported `kind`, an optional `effect` (`allow` by default), and
a string `value`:

```json
{
  "entries": [
    { "kind": "command", "value": "npm test" },
    { "kind": "domain", "effect": "deny", "value": "metadata.google.internal" }
  ]
}
```

Malformed JSON, unsupported top-level shapes or keys, invalid sections, and
malformed entry-array members are rejected with an error that identifies the
policy source. This prevents invalid input from being treated as an empty
policy during a comparison.

## Verify

Run the local validation script before opening a pull request:

```sh
bash scripts/validate.sh
```

`scripts/validate.sh` runs the repository's standard local checks when they are defined and will also run `agent-qc ready` when `agent-qc` is installed. Missing `agent-qc` is treated as a skip, not a failure.

## Release readiness

Run the same checks that CI uses before opening a release PR:

```sh
npm run release:readiness
npm run release:check
```

`release:readiness` validates repository metadata, the package files allowlist, package smoke coverage, and CI placeholder cleanup. `release:check` runs the project build, test, smoke, and package dry-run checks where configured.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution expectations. Changes
should be small, reviewable, and verified before review.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting guidance.

## License

MIT

## Verification

Run the release-readiness checks before publishing or cutting a PR:

```bash
npm run check
npm run build
npm run test
npm run smoke
npm run package:smoke
npm run release:check
```

Use `npm run package:smoke` or `npm pack --dry-run` to confirm the published tarball includes the support docs and runnable package contents.

## Limitations

permitdiff is a local-first helper for preparing reviewable evidence. It does not replace human review, live system validation, or project-specific policy checks, and generated output should be inspected before use in release or operational decisions.
