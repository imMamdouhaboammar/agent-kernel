# Local home layout

Agent Kernel stores its local shared memory under `AGENT_KERNEL_HOME`.

## Default path

```text
~/.agent-kernel
```

## Core folders

```text
source/memories/      approved memory source files
source/policies/      policy packs
source/schemas/       validation schemas
inbox/                pending, approved, rejected proposals
episodes/             episodic memory archive and index
dist/                 generated agent-specific files
logs/                 append-only operation logs
skills/               local skill folders
```

## Safety rule

The home layout must remain human-readable and portable before adding any opaque storage layer.
