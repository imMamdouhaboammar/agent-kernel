# Trusted mode install

Use this when the user trusts their local agents but still wants global memory protection.

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel init --sync
agent-kernel-mode set trusted
agent-kernel-safe-link .
```

## Result

Low-risk project memory can write directly. Global and critical memory remains pending.
