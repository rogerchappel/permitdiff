#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir="$(mktemp -d "/tmp/permitdiff-package-smoke.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT

cd "$repo_root"
npm run build >/dev/null
pack_json="$(npm pack --json --pack-destination "$tmp_dir")"
tarball="$(node -e "const data = JSON.parse(process.argv[1]); console.log(data[0].filename)" "$pack_json")"

mkdir -p "$tmp_dir/app"
cd "$tmp_dir/app"
npm init -y >/dev/null
npm install "$tmp_dir/$tarball" >/dev/null

node -e "import('permitdiff').then((mod) => { if (typeof mod.diffPolicies !== 'function') process.exit(1); })"
./node_modules/.bin/permitdiff compare "$repo_root/fixtures/base-policy.json" "$repo_root/fixtures/current-policy.json" --format markdown > "$tmp_dir/diff.md" 2>&1
./node_modules/.bin/permitdiff scan "$repo_root/fixtures/workspace" --out "$tmp_dir/policy.json" >/dev/null

test -s "$tmp_dir/diff.md"
test -s "$tmp_dir/policy.json"
