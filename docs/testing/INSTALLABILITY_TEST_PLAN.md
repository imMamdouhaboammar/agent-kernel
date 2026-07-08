# Installability test plan

Agent Kernel must prove that it can be installed and used on a fresh machine.

## Checks

```bash
npm pack --dry-run --ignore-scripts
npm install -g <packed-tarball>
agent-kernel --version
ak --version
agent-kernel init --sync
agent-kernel doctor
```

## Pass condition

All public binaries resolve on PATH and initialize local memory without a hosted backend.
