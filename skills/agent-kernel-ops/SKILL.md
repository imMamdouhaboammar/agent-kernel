---
name: agent-kernel-ops
description: Operational guide for agents working with Agent Kernel environment files, memory proposals, policies, and diagnostics
---

# Agent Kernel Operations Guide

Use this skill when the user mentions `agent-kernel`, `.env`, Environment Vault, memory proposals, agent rules, policies, or runtime diagnostics

## Environment Vault safety rules

- Never print, summarize, diff, log, or paste environment file contents
- Start with `agent-kernel env status [project]`
- Use `agent-kernel env doctor [project]` when the vault is unhealthy or permissions drift
- Use normal pull for missing files
- Do not use `--force` until the user understands that a differing local file will be replaced
- Keep backups enabled during forced restore unless the user explicitly requests otherwise
- Use `unlink` to detach a project path while retaining stored files
- Use `purge --yes` only after an explicit request to delete the stored vault
- Reject symlinks, non-regular files, paths outside the project root, and unstable project identity

## Environment Vault commands

Link the project and discover eligible environment files

```bash
agent-kernel env link [project]
```

Link exact Monorepo files

```bash
agent-kernel env link [project] \
  --include apps/api/.env \
  --include apps/web/.env.local
```

Check identity, health, and file states

```bash
agent-kernel env status [project]
agent-kernel env status [project] --json
```

Store local edits

```bash
agent-kernel env push [project]
agent-kernel env push [project] --file apps/api/.env
```

Preview without writing

```bash
agent-kernel env push [project] --dry-run
```

Restore missing files

```bash
agent-kernel env pull [project]
```

Handle an intentional overwrite with a backup

```bash
agent-kernel env pull [project] --force
```

Run health checks and repair POSIX permissions

```bash
agent-kernel env doctor [project]
agent-kernel env doctor [project] --repair-permissions
```

Migrate a matching legacy vault after inspection

```bash
agent-kernel env doctor [project] --migrate
```

Watch environment files edited outside an Agent Kernel hook

```bash
agent-kernel env watch [project]
```

Inspect revisions without secret contents

```bash
agent-kernel env history [project] --file .env
```

Restore one revision with normal conflict handling

```bash
agent-kernel env restore [project] --file .env --revision <revision-id>
```

Detach automatic behavior while retaining stored data

```bash
agent-kernel env unlink [project]
```

Delete stored data only after explicit confirmation

```bash
agent-kernel env purge [project] --yes
```

Read the complete command and security guide at `docs/ENVIRONMENT_VAULT.md`

## Memory and rule proposals

Propose a new rule

```bash
agent-kernel propose --from <agentName> --text "Your rule text" --reason "Why"
```

Inspect the approval inbox

```bash
agent-kernel inbox
```

Approve and publish a proposal

```bash
agent-kernel approve <proposalId> --publish
```

## Governance and quality guards

Run file and policy guards

```bash
agent-kernel guard [--staged|--file path]
```

Verify a named policy

```bash
agent-kernel policy check mandatory-bun-package-manager
```

## Health and context diagnostics

Check Kernel status

```bash
agent-kernel status
```

Run the main health doctor

```bash
agent-kernel doctor
```
