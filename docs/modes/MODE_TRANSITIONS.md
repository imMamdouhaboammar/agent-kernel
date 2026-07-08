# Mode transitions

Mode changes must be explicit.

## Allowed transitions

```text
approval -> trusted
trusted -> approval
trusted -> bypass
bypass -> trusted
bypass -> approval
```

## Recommended downgrade

After a bypass session, downgrade to approval:

```bash
agent-kernel-mode set approval
```

## Safety rule

Mode changes should be visible in config and future audit logs.
