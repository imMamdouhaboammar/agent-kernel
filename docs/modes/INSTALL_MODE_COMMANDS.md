# Install mode commands

The install flow must set an explicit write mode.

## Approval install

```bash
agent-kernel init --sync
agent-kernel-mode set approval
```

## Trusted install

```bash
agent-kernel init --sync
agent-kernel-mode set trusted
```

## Bypass install

```bash
agent-kernel init --sync
agent-kernel-mode set bypass
```

## Safety rule

Installers must not choose bypass without an explicit user-selected mode.
