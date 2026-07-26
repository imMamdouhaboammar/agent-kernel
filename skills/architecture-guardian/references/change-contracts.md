# Change contracts

A change contract is a short-lived, reviewable statement of intended implementation scope.

## Contract contents

A useful contract includes:

- task title and owner
- allowed file patterns
- forbidden or out-of-scope areas when needed
- expected new or changed files
- approved new dependencies
- required observable tests
- notes explaining unusual scope

## Lifecycle

```bash
agent-kernel architecture contract init . --task "..." --owner "..." --allow "..."
agent-kernel architecture contract show . --json
agent-kernel architecture contract validate . --json
agent-kernel architecture contract close . --json
```

Create the contract before broad implementation begins. Validate it before relying on hook enforcement. Close it after completion.

## Scope changes

If the implementation genuinely requires more scope, stop and review the contract change. Do not edit outside scope first and expand the contract afterward.

## What contracts are not

Contracts are not:

- permanent architecture maps
- blanket write permissions
- substitutes for tests
- permission to add any dependency under an allowed directory
- a way to hide unrelated refactors in one task

A narrow contract improves review quality because unexpected files and dependencies become visible.
