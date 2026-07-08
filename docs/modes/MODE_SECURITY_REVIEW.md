# Mode security review

Mode behavior should be reviewed as a security boundary.

## Review questions

- Can an agent enable bypass without the user?
- Can a malformed config fall back to bypass?
- Can trusted mode approve global critical rules?
- Can MCP approval bypass CLI mode?
- Are bypass writes auditable?

## Safety rule

Any answer that weakens approval should block release.
