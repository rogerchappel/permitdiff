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

Supported policy inputs:

- JSON manifests with `allow` / `deny` sections or `entries` arrays
- YAML manifests with `allow` / `deny` sections
- Markdown headings such as `## Allow Commands` and bullet lists

## Verify

Run the local validation script before opening a pull request:

```sh
bash scripts/validate.sh
```

`scripts/validate.sh` runs the repository's standard local checks when they are defined and will also run `agent-qc ready` when `agent-qc` is installed. Missing `agent-qc` is treated as a skip, not a failure.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution expectations. Changes
should be small, reviewable, and verified before review.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting guidance.

## Verification

Use the package scripts as the public smoke gates before publishing or changing CLI behavior.

- `npm run release:check`
- `npm run test`
- `npm run smoke`
- `npm run check`

## License

MIT
