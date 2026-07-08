# Approval mode install

Use this for safest production setup.

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel init --sync
agent-kernel-mode set approval
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

## Result

Agents read shared memory and write pending proposals only.
