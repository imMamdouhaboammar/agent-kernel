# Contributing to agent-kernel

Thanks for your interest in agent-kernel. This project is small, focused, and
shipped frequently — every PR makes a difference.

## Ground rules

- **Be focused.** One PR per concern (one command, one doc fix, one bug).
- **Be tested.** Add a smoke check to `test/smoke.mjs` if you touch commands.
- **Be documented.** Update `README.md` + `CHANGELOG.md` + relevant `docs/*.md`.
- **Be compatible.** Memory layout changes need a migration path.
- **Be professional.** No scope creep — small, mergeable PRs beat mega-PRs.

## Local development

```bash
git clone https://github.com/imMamdouhaboammar/agent-kernel
cd agent-kernel

npm install            # Install devDependencies (typescript)
npm run build          # src/cli.mjs → dist/cli.mjs
npm test               # Smoke tests
npm run typecheck      # tsc --noEmit
npm run lint           # Sanity linter (command surface, MCP tool names, secret patterns)
npm run size           # Preview the npm tarball
```

Before opening a PR, all four must be green:

```bash
npm run typecheck && npm test && npm run lint && npm run build
```

## Adding a new command

The CLI is intentionally a single `src/cli.mjs` file (keeps the npm package
< 100 KB). To add a command:

1. **Edit `src/cli.mjs`** — find the `dispatch(args)` function and add your case.
2. **Update `--help`** — add your command to the help text near the top.
3. **Update the README** — add to the "Core commands" section.
4. **Update `docs/`** — if your command is non-trivial, add a section to
   `docs/ARCHITECTURE.md` or a new `docs/<YOUR-COMMAND>.md`.
5. **Add a smoke test** to `test/smoke.mjs`.
6. **Run all checks** + update `CHANGELOG.md` under an `Unreleased` section.

## Adding a new MCP tool

Every command should also be exposed as an MCP tool. To add one:

1. Find the `mcp tools` block in `src/cli.mjs` and add a new entry:

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

2. Implement the handler in the `mcp call` dispatch.
3. Update `scripts/lint.mjs` to include the new tool name.
4. Add a smoke check: `node dist/cli.mjs mcp test` should list it.

## Memory layout compatibility

If your PR touches `~/.agent-kernel/source/memories/*.json` schema:

- **Add a migration** to `agent-kernel migrate json` (or a new `migrate v0.x`).
- **Update `docs/JSON_FIRST_STORAGE.md`** with the new schema.
- **Never break v0.0.1 layout** — auto-migration must remain in place.
- **Add a sample** to `examples/` so users can see the expected shape.

## Security

For any change that touches:

- `DEFAULT_DENY_COMMANDS` in `src/cli.mjs` (the safety guard)
- `DEFAULT_SECRET_PATTERNS` in `src/cli.mjs` (the secret scanner)
- `agent-kernel enforce install` (Claude hooks installer)
- `agent-kernel guard` (the deterministic guard scanner)

Please open a discussion first — these primitives are load-bearing for safety.

## Releasing (maintainers only)

agent-kernel uses tag-driven auto-release:

```bash
# 1. Bump version in package.json + CHANGELOG.md + commit
# 2. Push commit to master
git add package.json CHANGELOG.md src/cli.mjs dist/cli.mjs
git commit -m "release: v0.0.6 — <tagline>"
git push origin master

# 3. Tag + push (triggers both .github/workflows/npm-publish.yml AND release.yml)
git tag -a v0.0.6 -m "v0.0.6 — <tagline>"
git push origin v0.0.6

# 4. Verify
gh release view v0.0.6 --repo imMamdouhaboammar/agent-kernel
npm view @mamdouh-aboammar/agent-kernel@0.0.6
```

The tag push automatically:

- Runs `npm-publish.yml` → publishes to npm with provenance
- Runs `release.yml` → creates GitHub Release with CHANGELOG excerpt + tarball asset
- Skills.sh reindexes the repo (1-5 min delay)

## License

By contributing, you agree that your contributions will be licensed under MIT,
matching the project's existing license.