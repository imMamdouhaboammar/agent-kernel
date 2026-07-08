# macOS setup

macOS is the primary local development environment target.

## Install

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel init --sync
agent-kernel doctor
```

## Project setup

```bash
cd /path/to/project
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
agent-kernel-safe-git-hook . --dry-run
agent-kernel-safe-git-hook .
```

## Expected result

The project receives generated instruction files while preserving existing local instructions and hooks.
