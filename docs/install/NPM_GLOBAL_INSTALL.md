# npm global install

Global npm install is the primary user setup path.

## Command

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
agent-kernel init --sync
```

## Success criteria

- `agent-kernel` is available on PATH
- `ak` is available on PATH
- helper binaries are available on PATH
- `~/.agent-kernel` can be initialized

## Safety rule

Global install should not require postinstall scripts or a hosted service.
