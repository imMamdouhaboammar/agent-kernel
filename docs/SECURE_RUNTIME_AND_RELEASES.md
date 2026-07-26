# Secure runtime and release operations

## Local daemon default

The daemon is disabled until started and binds to `127.0.0.1` by default. Local requests do not require a token because the operating-system user boundary is the trust boundary.

Use `agent-kernel daemon status` to confirm the bound host, port, process ID, and authentication mode. Stop it when live capture is no longer needed.

## Remote daemon mode

Remote binding is rejected unless `AGENT_KERNEL_DAEMON_ALLOW_REMOTE=1` is set and `AGENT_KERNEL_DAEMON_TOKEN` contains at least 32 bytes. Remote clients must send the token as an HTTP bearer credential.

```bash
export AGENT_KERNEL_DAEMON_HOST=0.0.0.0
export AGENT_KERNEL_DAEMON_ALLOW_REMOTE=1
export AGENT_KERNEL_DAEMON_TOKEN="$(openssl rand -hex 32)"
agent-kernel daemon start
```

Place the daemon behind a private network, VPN, SSH tunnel, or another authenticated transport. Do not expose its port directly to the public internet. Request bodies are limited to 1 MiB and responses use `Cache-Control: no-store` plus `X-Content-Type-Options: nosniff`.

## File-backed identifier boundary

Session IDs, proposal IDs, episode IDs, commit-linked session IDs, and provider profile names are treated as identifiers, not paths. Values containing path separators, traversal segments, or unsupported characters are rejected before filesystem access.

The accepted identifier alphabet is intentionally narrow: ASCII letters, digits, dots, underscores, and hyphens, with bounded length. This prevents local record commands from reading, moving, or rewriting adjacent JSON and JSONL files.

## CI control set

Only these workflow families are maintained:

- CI for Node 18, 20, 22, and 24 plus package installation smoke tests
- Windows CI for Node 18, 20, and 22
- CodeQL with security-extended queries
- npm publish using GitHub OIDC and provenance
- GitHub Release with tarball and SHA-256 checksums
- GitHub Pages deployment for `docs/` only
- Daily README story-card refresh from a reviewed, commit-pinned source with a managed-block boundary

Actions are pinned to commit SHAs, checkout credentials are not persisted, and workflow permissions are minimized per job.


## Trusted publishing migration

The publish workflow requests an OIDC ID token and tries npm trusted publishing first. Until a package administrator configures `npm-publish.yml` as the package's trusted GitHub Actions publisher, the workflow can use the existing `NPM_TOKEN` secret as a narrowly scoped one-command fallback.

Configure trust with an interactive administrator session:

```bash
npm trust github @mamdouh-aboammar/agent-kernel \
  --file npm-publish.yml \
  --repo imMamdouhaboammar/agent-kernel \
  --allow-publish
```

After one successful OIDC release, remove the fallback block and revoke the automation write token. npm trusted publishing requires Node 22.14 or newer and npm 11.5.1 or newer; release jobs use Node 24.

## Release procedure

1. Update `CHANGELOG.md` and all version surfaces.
2. Run `npm ci` and `npm run verify:release`.
3. Run `npm run publish:dry` and install the generated tarball in a clean temporary project.
4. Review `git diff --check`, privacy checks, secret checks, and the complete working-tree diff.
5. Merge the reviewed branch into `master`.
6. Create and push the annotated tag matching `package.json` exactly.
7. Verify the npm package version, integrity metadata, provenance, GitHub Release assets, and checksums.

Never reuse a published npm version. A failed tag workflow should be repaired and rerun only when the registry confirms the target version was not published.
