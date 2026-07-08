# Agent write modes overview

Agent Kernel supports three write modes for agent-captured memory.

## Modes

| Mode | Agent writes | User approval | Intended use |
| --- | --- | --- | --- |
| `approval` | pending proposals | required | safest default |
| `trusted` | gated direct writes for low-risk/project-scoped memory | required for global or critical memory | daily trusted agents |
| `bypass` | direct approved writes | skipped | explicit high-trust sessions only |

## Core rule

All agents can read the same shared memory. Write behavior depends on the selected mode.

## Safety rule

The install command must make the selected mode explicit.
