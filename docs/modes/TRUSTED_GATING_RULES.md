# Trusted gating rules

Trusted mode is a gated mode, not a full bypass.

## Auto-write allowed

```text
scope=project
type=project-note
level=note
```

## Approval still required

```text
scope=global
level=critical
type=policy
```

## Safety rule

Trusted mode should reduce friction without letting agents rewrite global operating rules silently.
