# Self-Evolve & Self-Learning Engine Architecture in Agent Kernel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native **Self-Evolve & Self-Learning Engine** in Agent Kernel (`src/self-evolve-engine.mjs` & `agent-kernel evolve`) that captures agent executions, user corrections (`/learn`), automatically synthesizes repeatable **Playbooks**, and registers universal hooks across Antigravity, Claude, Codex, and OpenCode.

**Architecture:**
1. **Core Module (`src/self-evolve-engine.mjs`)**:
   - Playbook creation, evolution tracking (v1.0 -> v1.1), versioning, and execution.
   - Self-learning capture (`captureLearningMoment`) from user corrections and tool output traces.
   - Universal Hook registration engine (`installSelfEvolveHooks`) targeting Antigravity, Claude, Codex, OpenCode.
2. **CLI Commands (`commandEvolve` in `src/cli.mjs`)**:
   - Subcommands: `agent-kernel evolve <list|inspect|run|generate|playbooks|hooks>`
3. **Universal Hooks (`src/cli.mjs` & `bin/agent-kernel-router.mjs`)**:
   - `agent-kernel hook self-evolve`: Invoked during tool calls / session end to automatically update playbooks and learning moments.

## Task Breakdown

### Task 1: Create `src/self-evolve-engine.mjs`
**Files:**
- Create: `src/self-evolve-engine.mjs`
- Create: `test/self-evolve-engine.mjs`

- [ ] Implement `getEvolutionPaths()` returning `~/.agent-kernel/evolution/playbooks`, `~/.agent-kernel/evolution/learnings.json`.
- [ ] Implement `generatePlaybook({ title, topic, steps, triggerPatterns })`.
- [ ] Implement `listPlaybooks()`, `inspectPlaybook(id)`, `evolvePlaybook(id, outcome)`.
- [ ] Implement `captureLearningMoment({ prompt, correction, toolResult, type })`.
- [ ] Implement `installSelfEvolveHooks()` for Antigravity, Claude, Codex, OpenCode.

### Task 2: Integrate `commandEvolve` and `self-evolve` Hook into `src/cli.mjs`
**Files:**
- Modify: `src/cli.mjs`
- Modify: `scripts/build.mjs`
- Modify: `test/smoke.mjs`

- [ ] Add imports from `./self-evolve-engine.mjs`.
- [ ] Implement `commandEvolve(flags)`.
- [ ] Handle `agent-kernel hook self-evolve` in `commandHook`.
- [ ] Update `scripts/build.mjs` to copy `src/self-evolve-engine.mjs` to `dist/self-evolve-engine.mjs`.
- [ ] Wire `runSelfEvolveEngine` into `test/smoke.mjs`.

### Task 3: Create `skills/agent-kernel-evolve/SKILL.md`
**Files:**
- Create: `skills/agent-kernel-evolve/SKILL.md`

- [ ] Document self-evolution, playbook generation, and hook usage for all AI agents.
