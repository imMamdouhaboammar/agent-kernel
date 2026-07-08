# Mode selection prompt

Installers should ask for mode selection in plain language.

```text
How should agents write shared memory?
1. approval - safest, user approves every memory
2. trusted - low-risk project notes can write directly
3. bypass - agents write directly without approval
```

## Safety rule

If there is no answer, choose `approval`.
