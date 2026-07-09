#!/usr/bin/env bash
# examples/scripts/install-agent-pointers.sh
#
# Drop a global AGENTS.md pointer into the home directory of every coding
# agent that uses a file-based instruction contract (no MCP) so it can see
# the Agent Kernel constitution. Idempotent: re-running does not duplicate
# the marked block.
#
# Usage:
#   ./examples/scripts/install-agent-pointers.sh
#   ./examples/scripts/install-agent-pointers.sh --dry-run

set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
  esac
done

log()  { printf '  %s\n' "$*"; }
warn() { printf '  ! %s\n' "$*" >&2; }

AGENT_DIRS=(
  "$HOME/.cursor"
  "$HOME/.antigravity"
  "$HOME/.continue"
  "$HOME/.trae"
  "$HOME/.kiro"
)

POINTER='<!-- agent-kernel:start -->
# Agent Kernel Constitution (Agent Kernel 1.0.0)

Source of truth: `'"$HOME"'/.agent-kernel/dist/AGENTS.md`

This file is a pointer. The full constitution (rules, preferences, workflows,
failure lessons, episodic recall protocol) lives in the source of truth above.
Read that file for the complete guidance.

## Critical rules (inline for visibility)

- Never hardcode production secrets, API keys, or user PII in code, comments,
  test fixtures, or generated docs. Use environment variables or a secrets
  manager instead.
- For Next.js + Supabase + Vercel projects, never add local SQLite fallbacks
  or fake persistence. Use real Supabase migrations and verify RLS policies
  before declaring backend work done.

## Cross-agent access

This agent shares memory with Claude Code, Codex, Gemini CLI, and Antigravity
through the Agent Kernel. To propose a new rule or recall an episode, use:

```bash
agent-kernel propose --from <this-agent> --type rule --scope global \
  --level standard --targets all --text "<rule>" --reason "<why>"
agent-kernel episode search "<query>"
agent-kernel failure capture --from <this-agent> --type <type> \
  --command "<cmd>" --exit-code <n> --text "<error>"
```

Approval is a user action. Do not self-approve or self-publish.
<!-- agent-kernel:end -->'

for dir in "${AGENT_DIRS[@]}"; do
  target="$dir/AGENTS.md"
  if [ -d "$dir" ]; then
    if [ -f "$target" ] && grep -q "agent-kernel:start" "$target"; then
      log "$(basename "$dir"): pointer already installed"
      continue
    fi
    if [ "$DRY_RUN" = "1" ]; then
      log "DRY-RUN: would write pointer to $target"
    else
      printf '%s\n' "$POINTER" > "$target"
      log "$(basename "$dir"): pointer installed at $target"
    fi
  else
    log "$(basename "$dir"): skipped (dir does not exist)"
  fi
done

log ""
log "Done. Each pointer references $HOME/.agent-kernel/dist/AGENTS.md"
log "Run 'agent-kernel compile' to regenerate the source of truth."
