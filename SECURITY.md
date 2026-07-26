# Security policy

## Supported versions

Security fixes are released on the current npm `latest` line. Older versions may not receive backports. Upgrade before reporting a problem that is already fixed in the current release.

## Reporting a vulnerability

Email **mamdouhfces1997@gmail.com** instead of opening a public issue. Include the affected version, operating system, command surface, impact, and a minimal reproduction that does not contain real credentials or private data.

Expected handling targets:

- acknowledgement within 48 hours
- initial severity and scope assessment within 5 business days
- mitigation or release plan for validated critical issues within 7 days

Do not publish exploit details until a fixed version is available and users have had a reasonable upgrade window.

## Runtime trust boundaries

Agent Kernel is local-first, but local input is not automatically trusted.

- Session, proposal, episode, commit-link, and file-record identifiers are validated before they become filenames.
- Remote daemon binding is opt-in and requires both `AGENT_KERNEL_DAEMON_ALLOW_REMOTE=1` and a bearer token of at least 32 bytes.
- The default daemon host is `127.0.0.1`. Local shell access remains equivalent to local user access.
- Daemon request bodies are capped at 1 MiB and malformed URLs fail closed.
- Provider profiles are validated before they are used in credential references or GCloud configuration paths.
- Agents may propose memory, but only the user approval workflow can publish it.

See [`docs/SECURE_RUNTIME_AND_RELEASES.md`](./docs/SECURE_RUNTIME_AND_RELEASES.md).

## Security primitives

`agent-kernel guard` blocks destructive commands, unsafe download-to-shell pipelines, dangerous permissions, protected-branch force pushes, repository deletion, and recognized secret patterns. Safe-link and safe-git-hook commands preserve unmanaged content and use bounded managed blocks.

The public CLI avoids shell interpolation for child processes. Provider execution removes caller-controlled identity and target overrides before invoking Supabase or GCloud CLIs.

## CI and release integrity

The repository uses a small allowlisted workflow set with least-privilege permissions and commit-SHA-pinned actions. Pull requests run build, lint, typecheck, tests, audit, package validation, CodeQL, Windows checks, and platform smoke tests.

Tags matching `v*` must equal `package.json`. npm publishing requests GitHub Actions OIDC and provenance. A temporary, single-command token fallback remains until a package administrator completes the trusted-publisher migration. GitHub Releases attach the canonical npm tarball, source archive, and SHA-256 checksums. GitHub Packages is not used because the npm package scope differs from the repository owner.

## Out of scope

- malicious processes already running as the same local operating-system user
- compromise of the operating system, Node.js runtime, npm registry, GitHub, or configured cloud providers
- side-channel attacks against local JSON or JSONL storage
- denial of service against a daemon deliberately exposed beyond a trusted private network

## Bypass reporting

A reproducible bypass of an identifier boundary, approval boundary, provider target restriction, guard rule, safe-link boundary, authentication requirement, or release verification is a security issue and should be reported privately.
