# Mode rollback

Mode rollback should be simple.

## Recommended rollback

```bash
agent-kernel-mode set approval
```

## Bypass cleanup

After a bypass session, review memory changes and remove or deprecate noisy rules.

## Future command

```bash
agent-kernel mode audit --since <time>
```

## Safety rule

Returning to approval mode should never require deleting local memory.
