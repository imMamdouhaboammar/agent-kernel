# Wrapper package test plan

## Cases

1. package includes `bin/agent-kernel.mjs`
2. package includes routed helper scripts
3. `package.json#bin.agent-kernel` points to wrapper
4. `package.json#bin.ak` points to wrapper
5. npm pack dry-run lists wrapper files

## Pass condition

Installed users get safe public commands from the package.
