# Permission Escalation Example

`permitdiff` is useful when an agent workspace policy changes from narrow read-only permissions to broader command or network access.

```sh
permitdiff compare fixtures/base-policy.json fixtures/current-policy.json --format markdown
```

The bundled fixture pair demonstrates:

- a new shell command permission
- a widened filesystem entry
- a network permission that should receive human review

For repository audits, scan a workspace first and review the normalized policy before comparing it:

```sh
permitdiff scan fixtures/workspace --out /tmp/permitdiff-policy.json
permitdiff compare fixtures/base-policy.json /tmp/permitdiff-policy.json --format json
```
