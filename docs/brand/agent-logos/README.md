# Agent Logos Library

Official AI coding agent brand SVGs used across agent-kernel docs, the
landing page, and the README agent strip.

## Usage

Each file is a monochrome or color SVG sized to a `1em` viewBox, so it
scales cleanly with the surrounding `font-size`. Reference directly with
`currentColor` for mono variants, or as inline `<img>` for color variants.

```html
<!-- mono (inherits color) -->
<img src="./docs/brand/agent-logos/claudecode-color.svg" width="20" height="20" alt="Claude Code" />

<!-- color (uses the brand's own colors) -->
<img src="./docs/brand/agent-logos/antigravity-color.svg" width="20" height="20" alt="Antigravity" />
```

## Files

| File | Color? | Notes |
|---|---|---|
| `claudecode-color.svg` | yes | Claude Code brand mark |
| `codex-color.svg` | yes | OpenAI Codex brand mark |
| `cursor.svg` | mono | Cursor editor mark |
| `opencode.svg` | mono | OpenCode CLI mark |
| `antigravity-color.svg` | yes | Antigravity brand mark |
| `geminicli-color.svg` | yes | Gemini CLI brand mark |
| `kilocode.svg` | mono | Kilo Code extension mark |
| `kiro-color.svg` | yes | Kiro IDE mark |
| `minimax-color.svg` | yes | MiniMax mark |
| `openai.svg` | mono | OpenAI corporate mark |
| `openclaw-color.svg` | yes | OpenClaw mark |

## Provenance

Sourced from `voices/logos/` and the official brand asset packs. Each
SVG is committed to the repo as the canonical copy — do not edit
in-place; re-export from the source brand kit if a refresh is needed.

## License

Each brand mark is the property of its respective owner. Use only in
the context of identifying or describing that agent. See the
upstream brand guidelines for redistribution terms.