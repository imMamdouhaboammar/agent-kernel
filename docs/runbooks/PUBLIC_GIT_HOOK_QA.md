# Public git hook QA runbook

## Prepare

```bash
mkdir /tmp/ak-hook-qa
cd /tmp/ak-hook-qa
git init
mkdir -p .git/hooks
printf '#!/usr/bin/env sh\necho existing\n' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## Run

```bash
agent-kernel git-hook install .
```

## Verify

- existing hook body remains
- Agent Kernel marked block exists
- backup exists

## Safety rule

Do not approve a release if existing hook logic is lost.
