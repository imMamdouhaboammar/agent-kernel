```markdown
# agent-kernel Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches you the core development patterns, coding conventions, and workflows used in the `agent-kernel` TypeScript codebase. The repository is structured around modular CLI features, hook adapters, and clear documentation practices. You'll learn how to add new features, document protocols and hooks, fix bugs, and write tests following the project's conventions.

## Coding Conventions

**File Naming**
- Use kebab-case for all files.
  - Example: `agent-kernel-failure-lessons.mjs`

**Import Style**
- Use relative imports.
  ```typescript
  import { someFunction } from '../utils/helper';
  ```

**Export Style**
- Use named exports.
  ```typescript
  export function runAgent() { ... }
  ```

**Commit Messages**
- Follow Conventional Commits.
  - Prefixes: `docs:`, `feat:`, `fix:`, `testdata:`, `test:`, `chore:`
  - Example: `feat: add failure lessons CLI entry point`

**Documentation**
- Protocols: `docs/<FEATURE>_PROTOCOL.md`
- Hook usage: `docs/hooks/<FEATURE>_HOOK.md`
- General documentation: `AGENTS.md`

**Examples & Test Data**
- Place in `examples/` directory.
  - Example: `examples/failure-lessons-example.json`

## Workflows

### Feature Development with CLI, Hook, Docs, Tests
**Trigger:** When adding a new major feature or module  
**Command:** `/new-feature-module`

1. **Create CLI entry point**  
   - Add `bin/agent-kernel-<feature>.mjs`
2. **Implement hook adapter**  
   - Add `bin/agent-kernel-<feature>-hook.mjs`
3. **Document the feature protocol**  
   - Write `docs/<FEATURE>_PROTOCOL.md`
4. **Document hook usage**  
   - Write `docs/hooks/<FEATURE>_HOOK.md`
5. **Add example/test data**  
   - Add `examples/<feature>-example.json`
   - Add `examples/<feature>-settings.json`
6. **Write smoke or integration test**  
   - Add `test/<feature>.mjs`
7. **Expose new CLI bins**  
   - Update `package.json` to include new CLI commands
8. **Route new subcommand in main CLI**  
   - Update `bin/agent-kernel.mjs`
9. **Document feature in AGENTS.md**

**Example:**
```bash
# Add CLI entry point
touch bin/agent-kernel-failure-lessons.mjs

# Implement hook
touch bin/agent-kernel-failure-lessons-hook.mjs

# Document protocol and hook
touch docs/FAILURE_LESSONS_PROTOCOL.md
touch docs/hooks/FAILURE_LESSONS_HOOK.md

# Add example data
touch examples/failure-lessons-example.json
touch examples/failure-lessons-settings.json

# Write test
touch test/failure-lessons.mjs
```

---

### Feature Bugfix Followup
**Trigger:** When you add a new CLI or feature file and immediately fix a typo or bug in it  
**Command:** `/feature-fixup`

1. **Add new CLI or feature file**  
   - Example: `bin/agent-kernel-<feature>.mjs`
2. **Commit a fix to the same file**  
   - Example: Fix typo or logic bug in the just-added file

**Example:**
```bash
# Initial add
git add bin/agent-kernel-failure-lessons.mjs
git commit -m "feat: add failure lessons CLI"

# Immediate fix
# (edit file)
git add bin/agent-kernel-failure-lessons.mjs
git commit -m "fix: correct typo in failure lessons CLI"
```

---

### Feature Documentation Split
**Trigger:** When documenting a new feature and its hook adapter  
**Command:** `/document-feature-hooks`

1. **Create or update protocol documentation**  
   - `docs/<FEATURE>_PROTOCOL.md`
2. **Create or update hook documentation**  
   - `docs/hooks/<FEATURE>_HOOK.md`

**Example:**
```bash
touch docs/FAILURE_LESSONS_PROTOCOL.md
touch docs/hooks/FAILURE_LESSONS_HOOK.md
```

## Testing Patterns

- **Test Files:** Use `*.test.*` or `test/<feature>.mjs` naming.
- **Framework:** Not explicitly specified; likely uses Node.js or a minimal runner.
- **Placement:** All tests go in the `test/` directory.
- **Style:** Integration or smoke tests are preferred for new features.

**Example:**
```typescript
// test/failure-lessons.mjs
import { runFailureLessons } from '../bin/agent-kernel-failure-lessons.mjs';

describe('Failure Lessons CLI', () => {
  it('should process example data', () => {
    // test logic here
  });
});
```

## Commands

| Command                | Purpose                                         |
|------------------------|-------------------------------------------------|
| /new-feature-module    | Scaffold a new feature with CLI, hook, docs, tests |
| /feature-fixup         | Quickly follow up a new feature with a bugfix   |
| /document-feature-hooks| Split and update protocol/hook documentation    |
```
