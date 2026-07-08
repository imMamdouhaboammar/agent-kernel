# Linux setup

Linux should work through the same npm-based install path.

## Install

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel init --sync
```

## Verify

```bash
agent-kernel --version
agent-kernel status
agent-kernel doctor
```

## Project setup

```bash
agent-kernel-safe-link .
agent-kernel-safe-git-hook .
```

## Safety rule

Linux support should not depend on macOS-specific paths or shell features.
