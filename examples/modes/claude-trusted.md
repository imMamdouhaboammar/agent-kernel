# Claude trusted mode

Claude may use the mode-aware helper. Low-risk project notes can be written directly, while critical/global memory stays pending.

```bash
agent-kernel-mode set trusted
agent-kernel-agent-write --from claude --type project-note --scope project --level note --text "<memory>"
```
