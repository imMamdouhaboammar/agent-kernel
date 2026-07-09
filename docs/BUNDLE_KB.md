# Knowledge Bundle

Knowledge Bundle is a planned sharing layer for Agent Kernel.

The goal is to turn a user's approved memory, Failure Lessons, policies, skills, workflows, and selected episodes into one portable file that another user can inspect, import, review, and distribute across their own agent surfaces.

Working name:

```text
Bundle your KB
```

## Why this matters

Agent Kernel already helps one machine remember what the user and agents learned.

Knowledge Bundle extends that value to another machine or team:

```text
experienced user machine
  -> approved knowledge and lessons
  -> one portable bundle file
  -> recipient inspects bundle
  -> recipient imports to inbox or applies selected items
  -> Agent Kernel distributes knowledge to Claude, Codex, Cursor, Gemini, OpenCode, Antigravity, and AGENTS.md surfaces
```

This is useful for:

- moving your own agent memory from one laptop to another
- sharing a hardened repo playbook with a teammate
- onboarding a contractor to a project without sending scattered docs
- packaging repeated debugging lessons as ready knowledge
- distributing agency or team standards without giving agents full write access

## Safety model

Import should be review-first by default.

A bundle must not silently overwrite the recipient's approved memory. The default behavior should create pending proposals and show a diff before publish.

Rules:

1. Secrets are redacted by default.
2. Local absolute paths are removed or normalized by default.
3. Machine-specific config is excluded by default.
4. Imported items go to the proposal inbox unless the user explicitly chooses direct apply.
5. Conflicts are shown before publish.
6. The recipient owns final approval.
7. Generated files are rebuilt on the recipient machine after import.

## Proposed command surface

### Create a bundle

```bash
agent-kernel bundle create ./team-agent-kernel.akb \
  --scope approved \
  --include memories,failures,policies,skills,workflows,episodes \
  --redact
```

### Create a smaller project bundle

```bash
agent-kernel bundle create ./nextjs-supabase.akb \
  --project . \
  --include rules,failures,skills,policies \
  --redact
```

### Inspect before import

```bash
agent-kernel bundle inspect ./team-agent-kernel.akb
```

Expected output:

```text
Bundle: team-agent-kernel.akb
Schema: agent-kernel.bundle.v1
Created by: local user metadata, redacted by default
Items:
  rules: 42
  preferences: 8
  workflows: 11
  policies: 7
  failure_lessons: 34
  skills: 5
  episodes: 12
Conflicts predicted: 3
Secrets detected: 0
Local paths detected: 0
```

### Diff against current memory

```bash
agent-kernel bundle diff ./team-agent-kernel.akb
```

### Import to review inbox

```bash
agent-kernel bundle import ./team-agent-kernel.akb --to inbox
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

### Apply selected bundle categories

```bash
agent-kernel bundle import ./team-agent-kernel.akb \
  --include rules,workflows,failures \
  --to inbox
```

### Install and distribute after review

```bash
agent-kernel bundle install ./team-agent-kernel.akb \
  --review \
  --publish \
  --link .
```

The `install` command should be a guided flow. It should show a summary, conflicts, imported categories, affected generated files, and the exact project files that will be updated.

### Export for a public starter pack

```bash
agent-kernel bundle create ./public-nextjs-agent-pack.akb \
  --scope public \
  --include rules,workflows,skills,policies \
  --exclude episodes,logs,private-notes \
  --redact
```

## Bundle file format

The recommended file extension is:

```text
.akb
```

The bundle can be a compressed archive containing:

```text
manifest.json
checksums.json
source/memories/rules.json
source/memories/preferences.json
source/memories/workflows.json
source/memories/project-notes.json
source/memories/skills.json
source/failures/failure-lessons.json
source/policies/policies.json
episodes/index.json
episodes/archive/*.json
bundle-report.json
```

## Manifest shape

```json
{
  "schema": "agent-kernel.bundle.v1",
  "created_at": "2026-07-09T00:00:00.000Z",
  "agent_kernel_version": "1.0.0",
  "scope": "approved",
  "redaction": {
    "enabled": true,
    "removed_secret_patterns": 0,
    "removed_absolute_paths": 0
  },
  "counts": {
    "rules": 42,
    "preferences": 8,
    "workflows": 11,
    "policies": 7,
    "failure_lessons": 34,
    "skills": 5,
    "episodes": 12
  },
  "targets": [
    "AGENTS.md",
    "CLAUDE.md",
    "GEMINI.md",
    ".cursor/rules/00-agent-kernel.mdc",
    ".codex/AGENTS.md",
    ".agents/agents.md"
  ]
}
```

## MVP acceptance criteria

- `agent-kernel bundle create` creates one portable `.akb` file.
- `agent-kernel bundle inspect` reads the bundle without importing it.
- `agent-kernel bundle diff` compares bundle items with local memory.
- `agent-kernel bundle import --to inbox` creates pending proposals by default.
- `agent-kernel bundle install --review --publish --link .` runs an explicit guided flow.
- redaction runs before archive creation.
- conflicts are reported before import.
- generated files are rebuilt locally after approval.
- no credentials, private MCP config, or raw env data enter the bundle.

## Non-goals for MVP

- no hosted marketplace
- no automatic remote sync
- no silent direct overwrite
- no hidden approval by agents
- no importing untrusted code execution hooks by default

## Implementation notes

The first implementation should keep the archive format simple and auditable. A compressed tar or zip with JSON files is enough. Encryption and signing can come later after the basic inspect, diff, and inbox import flow is reliable.
