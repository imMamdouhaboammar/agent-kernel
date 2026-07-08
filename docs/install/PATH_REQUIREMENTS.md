# PATH requirements

Agent Kernel works best when its binaries are available on PATH.

## Required commands

```text
agent-kernel
ak
agent-kernel-safe-link
agent-kernel-safe-git-hook
agent-kernel-agent-propose
```

## Agent requirement

Agents that can run shell commands should call these binaries directly instead of editing memory files.

## Troubleshooting

If a command is missing, run:

```bash
npm bin -g
npm root -g
```

Then verify that the global npm bin folder is on PATH.
