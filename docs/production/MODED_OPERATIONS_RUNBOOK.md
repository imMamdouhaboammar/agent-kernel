# Moded operations runbook

## Start a safe session

```bash
agent-kernel-mode set approval
```

## Start a trusted session

```bash
agent-kernel-mode set trusted
```

## Start a bypass session

```bash
agent-kernel-mode set bypass
```

## End a bypass session

```bash
agent-kernel-mode set approval
agent-kernel memory list
```

## Safety rule

Review memory after bypass sessions.
