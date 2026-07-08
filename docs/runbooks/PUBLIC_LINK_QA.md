# Public link QA runbook

## Prepare

```bash
agent-kernel init --sync
mkdir /tmp/ak-link-qa
cd /tmp/ak-link-qa
git init
printf '# local\n' > AGENTS.md
```

## Run

```bash
agent-kernel link .
```

## Verify

- local content remains
- Agent Kernel marked block exists
- backup exists when file existed before linking

## Safety rule

Do not approve a release if local content is lost.
