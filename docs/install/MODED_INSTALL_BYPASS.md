# Bypass mode install

Use this only when the user explicitly chooses a bypass permissions workflow.

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel init --sync
agent-kernel-mode set bypass
agent-kernel-safe-link .
```

## Result

Agents may write approved memory directly. Review memory after the session.
