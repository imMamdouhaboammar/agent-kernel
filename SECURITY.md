# Security policy

## Reporting a vulnerability

Please email **mamdouhfces1997@gmail.com** (PGP key TBD) instead of opening a
public GitHub issue. I will respond within 48 hours and aim to ship a fix or
mitigation within 7 days for critical issues.

## Security primitives in this repo

agent-kernel ships a deterministic policy guard (`agent-kernel guard`). It
detects and blocks:

| Pattern | Risk |
|---|---|
| `rm -rf /` / `rm -rf ~` / `rm -rf $HOME` | Data loss |
| `curl ... \| sh` / `wget ... \| sh` | RCE via download |
| `chmod -R 777` | Privilege escalation |
| `git push --force` to `main`/`master` | History rewrite |
| `rm -rf .git` | Repo destruction |
| Leaked `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Google API keys, `sk-...`, `ghp_...` | Secret exposure |

The guard runs:

- Manually via `agent-kernel guard`
- On every `git commit` via the pre-commit hook (`agent-kernel git-hook install`)
- Optionally in CI via `examples/github-agent-kernel-guard.yml`

## Bypass reporting

If you find a way to bypass the guard, please report it. Bypass = security
issue, period.

## Threat model

agent-kernel assumes:

- The user's local machine is **trusted** (anyone with shell access can read
  `~/.agent-kernel/source/memories/*.json`).
- Network endpoints (Claude, OpenAI, etc.) are **untrusted** — secret
  scanning protects against accidental leak in committed files.
- Agents proposing rules are **semi-trusted** — they can propose, but cannot
  publish. The user must approve via `agent-kernel approve <id>`.

Out of scope:

- Memory file tampering by other local processes
- Side-channel attacks against the JSONL logs
- Compromised npm registry (we pin via lockfile + CI)

## Updates

Security fixes follow the standard release process — bumped version + CHANGELOG
entry + tag push triggers npm-publish + GitHub release. Critical fixes may
ship out-of-band via direct commit + manual publish.