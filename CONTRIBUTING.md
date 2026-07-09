# Contributing to agent-kernel

Thanks for your interest in agent-kernel. This project is small, focused, and shipped frequently. Every PR should make one clear improvement.

## Ground rules

- Be focused. One PR per concern: one command, one doc fix, one bug, one behavior change.
- Be tested. Add or update focused smoke coverage if you touch runtime behavior.
- Be documented. Update `README.md`, `CHANGELOG.md`, and the relevant `docs/*.md` file.
- Be compatible. Memory layout changes need a migration path.
- Be careful with generated files. Edit source behavior or source memory, not generated output.
- Be precise. Small, reviewable PRs are better than broad rewrites.

## Before you edit

Read these first:

1. `docs/ARCHITECTURE_NOW.md` for the current runtime shape.
2. `docs/OPERATING_MODEL.md` for the governance loop.
3. `docs/AGENT_RUNBOOK.md` if you are using an AI coding agent.
4. `docs/TROUBLESHOOTING.md` if the change starts from a setup, hook, MCP, linking, or memory failure.

Do not treat roadmap files as current behavior. The current runtime is the code plus `docs/ARCHITECTURE_NOW.md`.

## Local development

```bash
git clone https://github.com/imMamdouhaboammar/agent-kernel
cd agent-kernel

npm install            # Install devDependencies
npm run build          # src/cli.mjs -> dist/cli.mjs
npm test               # Smoke tests
npm run typecheck      # tsc --noEmit
npm run lint           # Sanity linter
npm run size           # Preview the npm tarball
```

Before opening a PR, all core gates should be green:

```bash
npm run build && npm test && npm run lint && npm run typecheck
```

Before a release, also run:

```bash
npm run size
npm run publish:dry
```

## Adding a new command

The CLI is intentionally a single `src/cli.mjs` file today. To add a command:

1. Edit `src/cli.mjs` and update command dispatch.
2. Update help output.
3. Add or update focused tests and wire them through `test/smoke.mjs`.
4. Update `README.md`, `docs/ARCHITECTURE_NOW.md`, and the relevant protocol doc.
5. Add a `CHANGELOG.md` entry under `Unreleased`.
6. Run `npm run build && npm test && npm run lint && npm run typecheck`.

Do not add production code under `src/adapters/`, `src/commands/`, `src/core/`, or `src/hooks/` unless the modularization is also wired into runtime, build, and tests.

## Adding a new helper binary

Helper binaries live in `bin/` when behavior is intentionally outside the monolithic CLI.

Checklist:

1. Add or edit the helper in `bin/`.
2. Update `package.json#bin` if the binary is public.
3. Add or update helper-specific smoke coverage.
4. Update `scripts/lint-bins.mjs` if binary validation needs to know about it.
5. Update `README.md`, relevant docs, and `CHANGELOG.md`.

## Adding a new MCP tool

Every user-facing command does not always need an MCP tool, but MCP-visible behavior must be explicit and tested. To add one:

1. Find the MCP tools block in `src/cli.mjs` and add a new entry:

```js
{
  name: 'agent_kernel_<your_tool>',
  description: 'One-line description of what the tool does.',
  inputSchema: {
    type: 'object',
    properties: { /* your args */ },
    required: [ /* required arg names */ ]
  }
}
```

2. Implement the handler in the MCP call dispatch.
3. Update `scripts/lint.mjs` if tool names are validated there.
4. Add or update MCP smoke coverage.
5. Update `docs/MCP_SERVER.md` and the docs map.

Keep the MCP trust boundary intact. Approval through MCP remains disabled by default unless the user explicitly asks for a trusted local workflow.

## Memory layout compatibility

If your PR touches `~/.agent-kernel/source/memories/*.json` schema:

- Add a migration to `agent-kernel migrate json` or a new migration command.
- Update `docs/JSON_FIRST_STORAGE.md` with the new schema.
- Update `docs/MEMORY_PROTOCOL.md` if semantics change.
- Never break the v0.0.1 layout without an automatic migration path.
- Add a sample to `examples/` when users need to see the expected shape.

## Safe-link and hook changes

For safe-link changes:

- preserve content outside Agent Kernel marked blocks
- keep repeated runs idempotent
- keep backups on by default
- add regression coverage for duplicate blocks and existing user content
- update `docs/SAFE_LINKING.md`

For hook changes:

- prefer narrow event-specific hooks
- keep hook output short and structured
- do not approve or publish memory from hooks
- document the expected agent lifecycle event
- update hook docs and examples

## Security

Open a discussion or make the security impact explicit for changes touching:

- `DEFAULT_DENY_COMMANDS` in `src/cli.mjs`
- `DEFAULT_SECRET_PATTERNS` in `src/cli.mjs`
- `agent-kernel enforce install`
- `agent-kernel guard`
- hook installers or hook payload handling
- MCP trust boundaries
- release and publish workflows

Never commit secrets, `.env` files, private MCP credentials, or local auth files.

## Troubleshooting before changing code

Before changing runtime code for a reported failure, check `docs/TROUBLESHOOTING.md`.

Many issues are caused by:

- stale generated dist output
- wrong `AGENT_KERNEL_HOME`
- global package path mismatch
- using direct link instead of safe-link
- uninstalled or non-executable git hook
- broad Claude hook matcher
- MCP client config pointing to the wrong command
- pending memory not yet approved and published

If the issue is docs drift rather than runtime behavior, update docs without changing code.

## Releasing, maintainers only

agent-kernel uses tag-driven auto-release:

```bash
# 1. Bump version in package.json + marketplace manifests + CHANGELOG.md + commit
git add package.json .claude-plugin/marketplace.json .claude-plugin/plugin.json CHANGELOG.md
git commit -m "release: vX.Y.Z"
git push origin master

# 2. Tag + push, triggers npm-publish.yml and release.yml
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z

# 3. Verify
gh release view vX.Y.Z --repo imMamdouhaboammar/agent-kernel
npm view @mamdouh-aboammar/agent-kernel@X.Y.Z
```

The tag push automatically:

- runs `npm-publish.yml` to publish to npm with provenance
- runs `release.yml` to create a GitHub Release with the CHANGELOG excerpt and tarball asset
- allows external discovery surfaces to reindex after the release

### Manual recovery

If the auto-publish or auto-release workflow fails:

```bash
# 1. Manual publish to npm, uses your local ~/.npmrc token
npm publish --access public

# 2. Re-attach the tarball to the existing release
git archive --prefix=agent-kernel-vX.Y.Z/ \
    --format=tar.gz \
    -o /tmp/agent-kernel-vX.Y.Z.tar.gz vX.Y.Z

gh release upload vX.Y.Z /tmp/agent-kernel-vX.Y.Z.tar.gz --clobber

# 3. Verify
npm view @mamdouh-aboammar/agent-kernel@X.Y.Z
gh release view vX.Y.Z --repo imMamdouhaboammar/agent-kernel
```

### Pre-flight checklist

Before tagging a release, locally run:

```bash
npm install
npm run build
npm run lint
npm run typecheck
npm test
npm run size
npm run publish:dry
```

All gates must be green. CI runs the core set on every push to `master` and on every `v*` tag for release workflows.

## License

By contributing, you agree that your contributions will be licensed under MIT, matching the project's existing license.
