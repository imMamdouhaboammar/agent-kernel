# Troubleshooting

This guide helps users and agents diagnose common Agent Kernel setup, linking, hook, MCP, memory, and release issues.

Use it before changing runtime code. Many failures are setup, stale generated output, wrong memory home, or unsafe direct edits.

---

## Fast diagnosis

Start with these commands:

```bash
agent-kernel --version
agent-kernel doctor
agent-kernel status
```

Then check the current memory home:

```bash
echo "$AGENT_KERNEL_HOME"
ls -la "${AGENT_KERNEL_HOME:-$HOME/.agent-kernel}"
```

If the package is installed globally but commands look stale:

```bash
which agent-kernel
npm list -g @mamdouh-aboammar/agent-kernel --depth=0
npm view @mamdouh-aboammar/agent-kernel version
```

---

## Common symptoms

| Symptom | Likely cause | First action |
|---|---|---|
| `agent-kernel` command not found | Package not installed globally, PATH issue, or shell cache | Run `npx -y @mamdouh-aboammar/agent-kernel --version` |
| Project files do not update | Generated dist is stale | Run `agent-kernel compile` then `agent-kernel-safe-link . --dry-run` |
| Agent Kernel block appears twice | Old linked file or manual copy | Run `agent-kernel-safe-link .` to collapse duplicate marked blocks |
| Existing `AGENTS.md` got mixed with generated text | Direct linker used where safe linker was better | Restore from git or backup, then use `agent-kernel-safe-link .` |
| Hook does not block a command | Hook not installed, wrong project path, or platform hook config not loaded | Run `agent-kernel-safe-git-hook . --dry-run`, then inspect `.git/hooks/pre-commit` |
| Claude hook creates too much noise | Matcher too broad or event choice too general | Use `PostToolUseFailure` for failure capture and narrow matchers |
| MCP server works in terminal but not agent | Agent config points to wrong binary or env | Re-run `agent-kernel mcp install <agent>` and inspect agent config |
| Memory proposal exists but agent does not see it | Proposal is pending, not approved and published | Run `agent-kernel inbox`, then approve and publish if valid |
| Failure Lesson not found | Error text does not match signature or lesson was never captured | Search by command, error code, package name, and root cause words |
| CI fails after docs-only change | Docs examples reference missing files or outdated commands | Check README, docs index, and package files list alignment |

---

## Install issues

### Command not found

Try the package through `npx` first:

```bash
npx -y @mamdouh-aboammar/agent-kernel --version
```

If that works, reinstall globally:

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
```

Check where the executable resolves:

```bash
which agent-kernel
which ak
```

If `ak` works but `agent-kernel` does not, the global npm bin directory may be stale in your shell. Restart the shell or refresh your shell hash:

```bash
hash -r
```

---

## Memory home issues

Agent Kernel defaults to:

```text
~/.agent-kernel
```

If `AGENT_KERNEL_HOME` is set, the CLI uses that instead.

Check it:

```bash
echo "$AGENT_KERNEL_HOME"
agent-kernel doctor
```

Common mistake: one terminal uses the default home while another uses a custom `AGENT_KERNEL_HOME`. This makes memory look missing even though it exists elsewhere.

To test with a clean temporary home:

```bash
export AGENT_KERNEL_HOME="$(mktemp -d)"
agent-kernel init --sync
agent-kernel status
```

---

## Project linking issues

For existing repositories, use safe linking:

```bash
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

Safe-link writes only inside this block:

```md
<!-- agent-kernel:start -->
...
<!-- agent-kernel:end -->
```

Content outside the block is user-owned and should remain untouched.

If a file contains duplicate Agent Kernel blocks, run:

```bash
agent-kernel-safe-link .
```

The safe-link path should collapse duplicate marked blocks into one canonical block.

If a direct link damaged hand-written project guidance:

1. Restore the file from git, editor history, or `.agent-kernel-backups/`.
2. Re-run safe-link with `--dry-run`.
3. Apply safe-link only after reviewing planned changes.

---

## Git hook issues

Install the safe pre-commit path:

```bash
agent-kernel-safe-git-hook . --dry-run
agent-kernel-safe-git-hook .
```

Check the hook exists:

```bash
cat .git/hooks/pre-commit
```

Run the guard manually before blaming the hook:

```bash
agent-kernel guard --staged
agent-kernel guard --file path/to/file
```

If the hook does not run, verify:

- the repository has a `.git/` directory
- the hook file is executable
- your Git client does not disable hooks
- the change is staged when using `--staged`

---

## Claude hook issues

Failure capture should use `PostToolUseFailure`, narrow matchers, exec-form commands, and short timeouts.

Bad pattern:

```text
PostToolUse with broad matcher and long-running shell logic
```

Better pattern:

```text
PostToolUseFailure with Bash|Write|Edit|MultiEdit and exec-form args
```

If Claude receives too much extra context, reduce the hook output. Hook output should be short, structured, and tied to the failed tool call.

See:

- `docs/hooks/FAILURE_LESSONS_HOOK.md`
- `docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md`

---

## MCP issues

Run the local MCP setup command:

```bash
agent-kernel mcp config
agent-kernel mcp install claude
```

If the agent cannot start the MCP server:

1. Check the installed command path.
2. Check `AGENT_KERNEL_HOME` inside the agent environment.
3. Run the same command manually in a terminal.
4. Check whether the client expects stdio MCP, not HTTP.

Approval through MCP is disabled by default. If an agent can search memory but cannot approve proposals, that is expected. The safer path is still:

```text
agent proposes -> user reviews inbox -> user approves -> kernel publishes
```

---

## Failure Lessons issues

Search before retrying:

```bash
agent-kernel failure search "ERR_MODULE_NOT_FOUND"
agent-kernel failure search "npm test"
agent-kernel failure list
```

A useful Failure Lesson needs:

- failing command
- exit code when available
- error text
- root cause
- fix path

If dedupe looks wrong, compare the project, command, and error signature. Repeated captures of the same `project + command + errorSignature` should update the existing lesson and increment occurrences.

Do not promote every captured failure. Promote only when the pattern is reusable.

---

## Docs drift issues

When docs and code disagree, check in this order:

1. `src/cli.mjs` for current core runtime behavior.
2. `bin/*.mjs` for helper binary behavior.
3. `docs/ARCHITECTURE_NOW.md` for the current architecture statement.
4. `README.md` for user-facing setup.
5. `docs/README.md` for documentation ownership rules.

Roadmap docs are not proof that behavior ships. Do not document planned features as current behavior.

---

## Daemon authentication issues

The default daemon is local-only. A non-loopback host must have both remote opt-in and a strong token:

```bash
export AGENT_KERNEL_DAEMON_HOST=0.0.0.0
export AGENT_KERNEL_DAEMON_ALLOW_REMOTE=1
export AGENT_KERNEL_DAEMON_TOKEN="$(openssl rand -hex 32)"
agent-kernel daemon start
```

A remote request without `Authorization: Bearer <token>` returns `401`. A token shorter than 32 bytes or a remote host without explicit opt-in prevents startup. If a request returns `413`, reduce its body below 1 MiB.

Do not put the token in command history, committed files, issue reports, or screenshots. Stop the daemon and rotate the token after temporary remote access.

---

## Release issues

Run the canonical gate before tagging:

```bash
npm ci
npm run verify:release
npm run publish:dry
```

`publish:dry` uses `npm pack --dry-run`; it does not query the registry for an unpublished version. The tag must exactly match `package.json`, for example package version `1.15.1` requires tag `v1.15.1`.

The canonical npm registry is npmjs. GitHub Packages workflows are intentionally absent because `@mamdouh-aboammar` does not match the repository owner `imMamdouhaboammar`.

If an old CodeScan job reports Java class-file incompatibility, remove or disable that obsolete workflow. The product does not require Java; CodeQL is the maintained static-analysis workflow.

Check these files stay aligned:

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

Use [`SECURE_RUNTIME_AND_RELEASES.md`](./SECURE_RUNTIME_AND_RELEASES.md) for tag, provenance, checksum, and recovery requirements.

---

## When to open an issue

Open an issue when:

- a command fails with a reproducible input
- safe-link duplicates or removes content outside marked blocks
- guard misses a clearly dangerous pattern
- MCP config is generated but the documented client cannot start it
- docs and shipped command behavior disagree

Include:

```text
agent-kernel --version
node --version
npm --version
operating system
command run
full error output
AGENT_KERNEL_HOME value, if set
whether the repo already had AGENTS.md, CLAUDE.md, GEMINI.md, Cursor rules, or .agents files
```
