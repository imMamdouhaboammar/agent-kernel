#!/usr/bin/env bash
# examples/scripts/install-agent-mcp.sh
#
# Install the agent-kernel-memory MCP server into global config files for
# coding agents that support it (Claude Code, Codex, Gemini CLI, Continue).
#
# Idempotent: re-running the script does not duplicate entries.
#
# Usage:
#   ./examples/scripts/install-agent-mcp.sh
#   ./examples/scripts/install-agent-mcp.sh --dry-run

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
done_marker() { printf '  ✓ %s\n' "$*"; }

ensure_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    warn "$1 not found in PATH. Install agent-kernel first: npm install -g @mamdouh-aboammar/agent-kernel"
    return 1
  fi
}

run_safe() {
  if [ "$DRY_RUN" = "1" ]; then
    log "DRY-RUN: $*"
  else
    "$@"
  fi
}

ensure_command agent-kernel || exit 1

# ----- Claude Code -----
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
if [ -f "$CLAUDE_SETTINGS" ]; then
  if grep -q '"agent-kernel-memory"' "$CLAUDE_SETTINGS"; then
    log "Claude Code: agent-kernel-memory MCP already configured"
  else
    log "Claude Code: installing agent-kernel-memory MCP"
    run_safe agent-kernel mcp install claude >/dev/null
    done_marker "Claude Code MCP installed"
  fi
else
  warn "Claude Code settings.json not found at $CLAUDE_SETTINGS"
fi

# ----- Codex -----
CODEX_CONFIG="$HOME/.codex/config.toml"
if [ -f "$CODEX_CONFIG" ]; then
  if grep -q 'mcp_servers\.agent-kernel-memory' "$CODEX_CONFIG"; then
    log "Codex: agent-kernel-memory MCP already configured"
  else
    log "Codex: appending [mcp_servers.agent-kernel-memory] to config.toml"
    if [ "$DRY_RUN" = "1" ]; then
      log "DRY-RUN: would append MCP block to $CODEX_CONFIG"
    else
      cat >> "$CODEX_CONFIG" <<'TOML'

[mcp_servers.agent-kernel-memory]
command = "agent-kernel"
args = ["mcp", "serve"]
type = "stdio"
TOML
      done_marker "Codex MCP installed"
    fi
  fi
else
  warn "Codex config.toml not found at $CODEX_CONFIG"
fi

# ----- Gemini CLI -----
GEMINI_SETTINGS="$HOME/.gemini/settings.json"
if [ -f "$GEMINI_SETTINGS" ]; then
  if grep -q '"agent-kernel-memory"' "$GEMINI_SETTINGS"; then
    log "Gemini CLI: agent-kernel-memory MCP already configured"
  else
    log "Gemini CLI: patching settings.json with mcpServers block"
    if [ "$DRY_RUN" = "1" ]; then
      log "DRY-RUN: would add mcpServers.agent-kernel-memory to $GEMINI_SETTINGS"
    else
      /usr/bin/python3 - "$GEMINI_SETTINGS" <<'PY'
import json
import sys
path = sys.argv[1]
with open(path) as f:
    settings = json.load(f)
settings.setdefault("mcpServers", {})["agent-kernel-memory"] = {
    "command": "agent-kernel",
    "args": ["mcp", "serve"],
    "type": "stdio"
}
with open(path, "w") as f:
    json.dump(settings, f, indent=2)
    f.write("\n")
PY
      done_marker "Gemini CLI MCP installed"
    fi
  fi
else
  warn "Gemini CLI settings.json not found at $GEMINI_SETTINGS"
fi

# ----- Continue -----
CONTINUE_CONFIG="$HOME/.continue/config.json"
if [ -f "$CONTINUE_CONFIG" ]; then
  if grep -q '"agent-kernel-memory"' "$CONTINUE_CONFIG"; then
    log "Continue: agent-kernel-memory MCP already configured"
  else
    log "Continue: appending mcpServers entry to config.json"
    if [ "$DRY_RUN" = "1" ]; then
      log "DRY-RUN: would append MCP entry to $CONTINUE_CONFIG"
    else
      /usr/bin/python3 - "$CONTINUE_CONFIG" <<'PY'
import json
import sys
path = sys.argv[1]
with open(path) as f:
    config = json.load(f)
servers = config.setdefault("mcpServers", [])
if not any(s.get("name") == "agent-kernel-memory" for s in servers):
    servers.append({
        "name": "agent-kernel-memory",
        "command": "agent-kernel",
        "args": ["mcp", "serve"],
        "type": "stdio"
    })
with open(path, "w") as f:
    json.dump(config, f, indent=2)
    f.write("\n")
PY
      done_marker "Continue MCP installed"
    fi
  fi
else
  warn "Continue config.json not found at $CONTINUE_CONFIG"
fi

log ""
log "Done. Verify with:"
log "  echo '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}' | agent-kernel mcp serve"
log "Restart each agent for MCP changes to take effect."
