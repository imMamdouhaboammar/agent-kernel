# Mode install prompts

Installers should present mode choices clearly.

## Prompt copy

```text
Choose Agent Kernel memory write mode:
1. approval - safest, agents write pending proposals
2. trusted - low-risk project notes can write directly
3. bypass - agents can write approved memory directly
```

## Default

Default to `approval` when the user does not choose.

## Safety rule

Bypass must include a warning before selection.
