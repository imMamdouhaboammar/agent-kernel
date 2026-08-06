# Troubleshooting

Use this guide before changing runtime code

Many Agent Kernel failures come from stale generated output, different Agent Kernel homes, unresolved project identity, incomplete linking, or unsafe direct edits

## Fast diagnosis

```bash
agent-kernel --version
agent-kernel doctor
agent-kernel status
agent-kernel env status
```

Check the current Agent Kernel home

```bash
echo "$AGENT_KERNEL_HOME"
ls -la "${AGENT_KERNEL_HOME:-$HOME/.agent-kernel}"
```

Check the public executable

```bash
which agent-kernel
which ak
npm list -g @mamdouh-aboammar/agent-kernel --depth=0
```

## Bun and Node environment setup

Agent Kernel works with both npm and Bun. The following covers common setup issues specific to each runtime.

### Installing with Bun

```bash
bun install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
```

If the `agent-kernel` command is not found after a Bun global install, confirm that Bun's global bin directory is on your PATH:

```bash
echo $PATH | tr ':' '\n' | grep bun
# Expected output should include something like: /Users/<you>/.bun/bin
```

If missing, add it to your shell profile (`~/.zshrc`, `~/.bashrc`, or `~/.profile`):

```bash
export PATH="$HOME/.bun/bin:$PATH"
```

Then reload your shell and retry.

### Bun version conflicts

Some Bun versions below `1.0` have module resolution differences that can cause `ERR_MODULE_NOT_FOUND`. Upgrade Bun:

```bash
bun upgrade
bun --version
```

Agent Kernel requires Node.js `>=18.18.0` or a compatible Bun runtime.

### Node version issues

If using Node directly, confirm the active version:

```bash
node --version
```

If below `18.18.0`, use a version manager such as `nvm` or `fnm`:

```bash
# With nvm
nvm install 20
nvm use 20
node --version
```

After switching Node versions, reinstall the global package:

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
```

### PATH not updated after install

Some shell environments cache the `PATH` lookup. After global install, run:

```bash
hash -r            # bash/zsh: clear the command hash cache
exec $SHELL -l     # reload shell profile
agent-kernel --version
```

---

## Agent configuration snippets

The following are minimum configuration examples for connecting Agent Kernel to popular AI coding clients.

### Claude Code

Add the MCP server to your Claude Code configuration. The easiest path is via the `agent-kernel` command itself:

```bash
agent-kernel mcp install claude
```

Or add manually to `~/.claude.json` (Claude Code's global config):

```json
{
  "mcpServers": {
    "agent-kernel": {
      "command": "agent-kernel",
      "args": ["mcp"],
      "env": {}
    }
  }
}
```

Wire the context hook in `.claude/settings.json` inside your project:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "agent-kernel-claude-context-hook"
          }
        ]
      }
    ]
  }
}
```

### Cursor

Add Agent Kernel's MCP server in Cursor's settings (`Cursor > Settings > MCP`):

```json
{
  "mcpServers": {
    "agent-kernel": {
      "command": "agent-kernel",
      "args": ["mcp"],
      "env": {}
    }
  }
}
```

To ensure Cursor picks up your custom `AGENT_KERNEL_HOME`, set the environment variable before launching Cursor, or add it to your shell profile.

Cursor reads `.cursor/rules` for project-level AI instructions. Link your compiled Agent Kernel guidance to this file:

```bash
agent-kernel-safe-link . --no-backup
```

### Gemini CLI (Antigravity / agy)

Agent Kernel integrates with Gemini CLI through its rules and MCP configuration. Add to `~/.gemini/config/mcp_config.json` or the project-local `.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "agent-kernel": {
      "command": "agent-kernel",
      "args": ["mcp"],
      "transport": "stdio"
    }
  }
}
```

To wire project guidance into Gemini CLI's context, link your compiled rules:

```bash
agent-kernel compile
agent-kernel-safe-link .
```

This writes an `AGENTS.md` block into your project root, which Gemini CLI (and other `AGENTS.md`-compatible agents) reads automatically.

Set `AGENT_KERNEL_HOME` in your shell profile if you use a non-default install location:

```bash
export AGENT_KERNEL_HOME="$HOME/.agent-kernel"
```

### Codex

Add the MCP configuration via the CLI:

```bash
agent-kernel mcp install codex
```

Or add to `.codex/mcp.json` inside your project:

```json
{
  "mcpServers": {
    "agent-kernel": {
      "command": "agent-kernel",
      "args": ["mcp"]
    }
  }
}
```

---

## Common symptoms

| Symptom | Likely cause | First action |
|---|---|---|
| `agent-kernel` command not found | Package missing from the global PATH or stale shell command cache | Run `npx -y @mamdouh-aboammar/agent-kernel --version` |
| Project guidance does not update | Generated output is stale | Run `agent-kernel compile` then `agent-kernel-safe-link . --dry-run` |
| Agent Kernel block appears twice | Old manual copy or duplicated marked block | Run `agent-kernel-safe-link .` |
| Hook does not block a command | Hook missing, wrong project path, or client hook config not loaded | Run `agent-kernel-safe-git-hook . --dry-run` |
| MCP works in terminal but not in an agent | Wrong executable path or different environment | Run the configured command manually with the same `AGENT_KERNEL_HOME` |
| Memory proposal exists but an agent cannot see it | Proposal is pending rather than approved and published | Run `agent-kernel inbox` |
| `env pull` reports a conflict | Local and stored hashes differ | Run `agent-kernel env status`, then decide whether to preserve local content or use `--force` |
| Fresh clone has no matching vault | Remote identity differs, project has no stable Git identity, or another Agent Kernel home is active | Check `git remote get-url origin` and `AGENT_KERNEL_HOME` |
| Environment status reports permission drift | Existing file or vault copy is broader than owner-only | Run `agent-kernel env doctor --repair-permissions` |
| Environment Vault is locked | Another push, link, migration, or watcher is active | Stop the other process and retry |
| Environment manifest is unhealthy | Corrupt JSON, unsupported version, invalid path, or missing stored file | Run `agent-kernel env doctor --json` and preserve the vault before manual recovery |
| CI fails after a documentation change | Command examples, file references, or package contents drifted | Run `npm run docs:check` and `npm run publish:dry` |

## Installation issues

### Command not found

Try the package without global installation

```bash
npx -y @mamdouh-aboammar/agent-kernel --version
```

If that works, reinstall globally

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
```

Refresh the shell command cache when needed

```bash
hash -r
```

### Installed command behaves like an older release

```bash
which agent-kernel
agent-kernel --version
npm list -g @mamdouh-aboammar/agent-kernel --depth=0
npm view @mamdouh-aboammar/agent-kernel version
```

Confirm that the resolved executable belongs to the expected package manager prefix

## Agent Kernel home issues

The default home is

```text
~/.agent-kernel
```

A configured `AGENT_KERNEL_HOME` replaces that path for memory, Vault data, update state, runtime shims, logs, and reports

```bash
echo "$AGENT_KERNEL_HOME"
agent-kernel doctor
agent-kernel env list
```

A common mistake is running an agent with one home and a terminal with another

Test with a clean isolated home

```bash
export AGENT_KERNEL_HOME="$(mktemp -d)"
agent-kernel init --sync
agent-kernel status
```

## Project Environment Vault issues

Read [`ENVIRONMENT_VAULT.md`](./ENVIRONMENT_VAULT.md) for the complete command and storage contract

### Project has no stable Git identity

Environment Vault uses a canonical Git remote first, then the initial commit hash

Check both

```bash
git remote get-url origin
git rev-list --max-parents=0 HEAD
```

For a new repository, create the first commit or configure the remote

```bash
git add .
git commit -m "chore: initialize project"
git remote add origin <repository-url>
```

Use path identity only for an intentional local-only project

```bash
agent-kernel env link --allow-path-identity
```

Path identity changes when the folder moves

### Fresh clone is not matched

Compare the remote used by the original project and the new clone

```bash
git remote get-url origin
agent-kernel env status --json
```

Common GitHub SSH and HTTPS forms resolve to the same identity

A fork, mirror, renamed path, or different host is treated as a separate project

Also confirm the same Agent Kernel home is active on the machine

```bash
echo "$AGENT_KERNEL_HOME"
agent-kernel env list
```

Environment Vault is local and does not copy secrets between computers

### No eligible files found

Default discovery includes `.env` and `.env.*` recursively and excludes templates such as `.env.example`

Select an exact Monorepo file

```bash
agent-kernel env link \
  --include apps/api/.env \
  --include apps/web/.env.local
```

Link an intentionally empty project

```bash
agent-kernel env link --allow-empty
```

### Symlink or non-regular file rejected

The Vault does not follow environment-file symlinks and does not accept directories, sockets, devices, or FIFOs

Replace the symlink with a regular file inside the project root, or manage that secret through the external source that owns the symlink

Do not bypass this check by copying a target outside the project into the Vault path manually

### File exceeds the size limit

The default limit is 1 MiB per environment file

Confirm that the file is genuinely an environment configuration file rather than a certificate bundle, database dump, or generated artifact

Increase the limit only when the content is expected

```bash
agent-kernel env link --max-bytes 2097152
```

### Pull reports a conflict

A normal pull restores missing files only and refuses to overwrite a differing local file

```bash
agent-kernel env status
agent-kernel env pull --dry-run
```

Preserve the local file manually, push it as the new stored revision, or restore the Vault copy with a backup

```bash
agent-kernel env push
```

```bash
agent-kernel env pull --force
```

Forced restore writes the previous local file under

```text
<project>/.agent-kernel/env-backups/<timestamp>/
```

Keep backups enabled unless there is a specific reason not to

### Permission drift

Inspect and repair owner-only permissions

```bash
agent-kernel env doctor
agent-kernel env doctor --repair-permissions
```

On POSIX systems, Vault directories should be `0700` and Vault files should be `0600`

Windows access is governed by Windows ACL behavior rather than POSIX mode bits

### Vault is locked

Another writer or watcher may be active

Stop other `agent-kernel env watch`, link, push, migration, or restore processes and retry

The Vault removes a stale lock only when it is old, was created on the same host, and its recorded process is no longer running

Do not delete a recent lock while another process may still be writing

### Manifest is corrupt

Run doctor in JSON mode

```bash
agent-kernel env doctor --json
```

A corrupt manifest blocks writes rather than silently creating new metadata for the same directory

Preserve the entire Vault directory before manual recovery

```text
${AGENT_KERNEL_HOME:-~/.agent-kernel}/vault/env/<fingerprint>/
```

Check legacy backups when a migration was attempted

```text
${AGENT_KERNEL_HOME:-~/.agent-kernel}/vault/legacy-backups/
```

### Migrate the previous Vault format

```bash
agent-kernel env doctor --migrate
```

Migration searches for a matching legacy identity, copies the old Vault to a backup, creates a version 2 manifest, and retains the original legacy directory

Normal commands do not silently migrate legacy data

### Watcher does not detect an external edit

Confirm the file was selected during link

```bash
agent-kernel env status --json
```

Restart the watcher after adding or removing selected files

```bash
agent-kernel env watch --interval 15
```

The periodic reconciliation handles file events that are dropped or coalesced by the operating system

### Unlink did not delete the Vault

This is expected

```bash
agent-kernel env unlink
```

Unlink detaches the current project path and retains files and revisions

Destructive deletion is separate

```bash
agent-kernel env purge --yes
```

## Project linking issues

For existing repositories, use safe linking

```bash
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

Safe linking writes only inside marked blocks

```md
<!-- agent-kernel:start -->
...
<!-- agent-kernel:end -->
```

Content outside the markers is user-owned

If direct linking damaged hand-written guidance

1. Restore the file from Git, editor history, or `.agent-kernel-backups/`
2. Run safe link with `--dry-run`
3. Apply the reviewed change

## Git hook issues

```bash
agent-kernel-safe-git-hook . --dry-run
agent-kernel-safe-git-hook .
```

Check the hook

```bash
cat .git/hooks/pre-commit
```

Run the guard manually

```bash
agent-kernel guard --staged
agent-kernel guard --file path/to/file
```

Confirm that the repository has Git metadata, the hook is executable, the client permits hooks, and the intended files are staged

## Claude hook issues

Failure capture should use `PostToolUseFailure`, narrow matchers, exec-form commands, and bounded timeouts

Broad `PostToolUse` matchers can create noise and unnecessary context

See

- `docs/hooks/FAILURE_LESSONS_HOOK.md`
- `docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md`

## MCP issues

```bash
agent-kernel mcp config
agent-kernel mcp install claude
```

When the client cannot start the server

1. Check the executable path
2. Check `AGENT_KERNEL_HOME` inside the client process
3. Run the same command manually
4. Confirm the client expects stdio MCP

MCP approval is disabled by default

The normal governance flow remains

```text
agent proposes
user reviews inbox
user approves
Agent Kernel publishes
```

## Failure Lessons issues

```bash
agent-kernel failure search "ERR_MODULE_NOT_FOUND"
agent-kernel failure search "npm test"
agent-kernel failure list
```

A useful lesson includes the failing command, exit code when available, error signature, cause, remedy, and verification evidence

Repeated captures for the same project, command, and error signature should update the existing lesson rather than create uncontrolled duplicates

## Documentation drift

Check current behavior in this order

1. `bin/agent-kernel-router.mjs` for public routing
2. The focused `bin/*.mjs` command when the family is routed
3. `src/cli.mjs` for core commands and hooks
4. `docs/ARCHITECTURE_NOW.md` for the current architecture statement
5. `README.md` and the dedicated feature guide

Roadmap documents are not proof of shipped behavior

## Daemon authentication issues

A non-loopback daemon requires explicit remote opt-in and a strong token

```bash
export AGENT_KERNEL_DAEMON_HOST=0.0.0.0
export AGENT_KERNEL_DAEMON_ALLOW_REMOTE=1
export AGENT_KERNEL_DAEMON_TOKEN="$(openssl rand -hex 32)"
agent-kernel daemon start
```

Do not place the token in command history, committed files, issue reports, or screenshots

Stop the daemon and rotate the token after temporary remote access

## Release issues

Run the canonical gate before tagging

```bash
npm ci
npm run verify:release
npm run publish:dry
```

The tag must match `package.json`

For example, package version `1.19.0` requires tag `v1.19.0`

Check these surfaces remain aligned

```text
package.json
package-lock.json
CHANGELOG.md
README.md
src/cli.mjs
dist/cli.mjs
bin/* version constants
.claude-plugin/marketplace.json
.claude-plugin/plugin.json
```

Use [`SECURE_RUNTIME_AND_RELEASES.md`](./SECURE_RUNTIME_AND_RELEASES.md) for provenance, checksums, tags, and recovery

## Opening an issue

Include

```text
agent-kernel --version
node --version
npm --version
operating system
command run
full error output with secret values removed
AGENT_KERNEL_HOME value when set
Git remote form when the issue concerns project identity
whether the repository already contained agent guidance or hook files
```

Never attach `.env` contents, Vault files, credential-bearing Git remotes, access tokens, or screenshots that expose secrets
