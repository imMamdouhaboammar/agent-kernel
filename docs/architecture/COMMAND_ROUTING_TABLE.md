# Command routing table

| Public command | Routed to | Reason |
| --- | --- | --- |
| `agent-kernel link` | `agent-kernel-safe-link` | preserve project files |
| `agent-kernel git-hook install` | `agent-kernel-safe-git-hook` | preserve existing hooks |
| `agent-kernel --version` | `dist/cli.mjs` | unchanged runtime command |
| `agent-kernel init` | `dist/cli.mjs` | unchanged runtime command |
| `agent-kernel doctor` | `dist/cli.mjs` | unchanged runtime command |

## Safety rule

Routing should be explicit and documented before release.
