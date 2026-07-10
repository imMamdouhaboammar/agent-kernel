# File context

`agent-kernel file-context` returns the local knowledge related to one or more files before an agent edits them.

## Usage

```bash
agent-kernel file-context src/cli.mjs
agent-kernel file-context src/cli.mjs test/smoke.mjs --budget 1200
agent-kernel file-context src/cli.mjs --json
```

The command runs directly against the local Agent Kernel home. Daemon mode is not required.

## Sources

Results may include:

- approved memory records that reference the requested files
- Failure Lessons with matching file evidence
- archived episodes linked to the files
- session observations involving the files
- file-related guard policies
- pending memory proposals, marked as unapproved

Rejected proposals are not read or returned.

## Path handling

Input paths are normalized relative to the detected Git project root when possible. Absolute paths inside the project are returned as project-relative paths. Paths outside the project remain absolute.

Existing records without a `files` field remain searchable through conservative text matching. Records with explicit file references receive a higher relevance score.

## Ranking

Matches are ordered by:

1. explicit file-reference matches
2. full-path text matches
3. filename-only text matches
4. criticality and approval status
5. recency when relevance scores are equal

## Budget

`--budget` limits the rendered context in characters. The JSON response includes `budget`, `budgetUsed`, `context`, per-source `sections`, and total pre-budget `counts`.

```json
{
  "files": ["src/cli.mjs"],
  "budget": 1200,
  "budgetUsed": 642,
  "context": "## Approved Memory...",
  "sections": {
    "approvedMemory": [],
    "failureLessons": [],
    "episodes": [],
    "sessionObservations": [],
    "guardPolicies": [],
    "pendingProposals": []
  }
}
```

## Safety

Known secret patterns are redacted from rendered and structured results. Pending proposals are labeled `[PENDING, UNAPPROVED]` in text output and include `approved: false` in JSON output.
