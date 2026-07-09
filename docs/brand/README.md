# Brand assets

This folder contains lightweight SVG assets for the Agent Kernel README and marketing surfaces.

## Files

| File | Purpose |
|---|---|
| `agent-kernel-logo.svg` | Minimal repo logo for README, cards, and package pages |
| `agent-kernel-wordmark.svg` | README wordmark lockup |
| `agent-kernel-readme-lockup.svg` | Current README hero slot. It now mirrors the supported-agent stack strip |
| `agent-kernel-hero.svg` | Architecture hero explaining the local memory flow |
| `agent-strip.svg` | Supported-agent stack strip with uploaded agent marks and balanced padding |
| `agent-strip-icons.svg` | Legacy cache-busted strip path kept for compatibility with older README renders |

## Icon source and trademark boundary

`agent-strip.svg` and the current README lockup use marks adapted from the uploaded SVG icon set for the supported agent surfaces shown in the README.

Names and marks such as Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Antigravity, Kiro, Kilo Code, MiniMax, OpenClaw, OpenAI, and related AI tooling brands belong to their respective owners.

When adding or changing vendor marks:

1. use SVGs only from an approved source or uploaded asset
2. keep the strip restrained and legible at README scale
3. keep the trademark note visible in the SVG
4. do not imply official partnership, endorsement, or certification

## README slot note

The README still uses `agent-kernel-readme-lockup.svg` as the stable hero slot, but that file now contains the same supported-agent strip visual as `agent-strip.svg`. This avoids breaking the README layout while replacing the previous command-line hero visual.

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
- compact panels with controlled radius
- clear outer padding and safe inner chip margins
- JetBrains Mono / monospace typography
- thin text weight for README visuals
- uploaded agent marks where available
- no clipped strokes at SVG edges
- minimal copy
- readable inside GitHub dark and light modes
