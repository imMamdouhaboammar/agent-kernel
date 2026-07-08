# Moded install QA

After install, verify the selected mode.

## Commands

```bash
agent-kernel --version
agent-kernel-mode show
agent-kernel status
agent-kernel doctor
```

## Expected

`agent-kernel-mode show` should print the selected mode and config path.

## Safety rule

Do not start a bypass session without confirming the mode first.
