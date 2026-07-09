# Brand assets

This folder contains lightweight SVG assets for the Agent Kernel README and marketing surfaces.

## Files

| File | Purpose |
|---|---|
| `agent-kernel-logo.svg` | Minimal repo logo for README, cards, and package pages |
| `agent-kernel-hero.svg` | README hero explaining the local memory flow |
| `agent-strip-icons.svg` | README-supported agent surface strip using thin typography and embedded icon marks |
| `agent-strip.svg` | Legacy strip path kept for compatibility with older README renders and caches |

## Icon source and trademark boundary

`agent-strip-icons.svg` uses the uploaded LobeHub icon SVGs for the supported agent surfaces shown in the README. The visual treatment is repo-owned, but the vendor names and marks are not.

Names and marks such as Claude Code, Codex, Cursor, Gemini CLI, OpenCode, and related AI tooling brands belong to their respective owners.

When adding or changing vendor marks:

1. use SVGs only from an approved source or uploaded asset
2. keep the strip restrained and legible at README scale
3. keep the trademark note visible in the SVG
4. do not imply official partnership, endorsement, or certification

## Cache note

The README points to `agent-strip-icons.svg` rather than the original `agent-strip.svg` path so GitHub does not keep serving a previously cached render of the old strip.

## Visual identity

| Token | Value | Use |
|---|---|---|
| Primary background | `#050505` | outer SVG base |
| Panel background | `#0B0B0B` | chips and content panels |
| Quiet border | `#2A2A2A` | panel borders and grid |
| Primary text | `#F4F4F1` | readable off-white text |
| Secondary text | `#8E8E88` | descriptions and notes |
| Signal accent | `#F8F46A` | kernel signal and connectors |

## Visual direction

- dark technical base
- compact panels with lower radius
- JetBrains Mono / monospace typography
- thin text weight for README visuals
- original icon marks where available
- no clipped strokes at SVG edges
- minimal copy
- readable inside GitHub dark and light modes
