# Exceptions

Exceptions are explicit, scoped, owned, and expiring authorizations for a known finding.

## Required fields

Every exception should identify:

- rule or finding fingerprint
- affected file patterns
- reason
- owner
- expiry

```bash
agent-kernel architecture exception add . \
  --rule no-cycles \
  --files "src/legacy/**" \
  --reason "Reviewed two-release migration" \
  --owner platform \
  --expires "2026-12-31T00:00:00.000Z"
```

## Review rules

- scope must be as narrow as possible
- expiry must reflect the migration or constraint
- a broad permanent ignore is not a valid exception
- an expired exception does not suppress findings
- revoke the exception when the constraint ends

```bash
agent-kernel architecture exception list . --json
agent-kernel architecture exception revoke . <exception-id>
```

Exceptions should preserve visibility in reports. Suppressed does not mean resolved.
