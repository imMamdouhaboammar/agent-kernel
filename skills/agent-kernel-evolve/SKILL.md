---
name: agent-kernel-evolve
description: Universal Self-Evolve & Self-Learning guide for AI agents. Enables any agent (Claude, Antigravity, Cursor, Codex, Gemini, OpenCode) to automatically capture learning moments, synthesize repeatable Playbooks, and evolve workflows.
---

# Agent Kernel Self-Evolve Operations Guide

This skill provides step-by-step instructions for AI agents to capture learnings, auto-generate Playbooks, and install self-evolution hooks across all AI agent environments.

## Triggers & Trigger Phrases
Activate this skill when:
- The user mentions `self-evolve`, `/learn`, `playbook`, `workflow synthesis`, or `agent learning`.
- You resolve a complex multi-step feature or receive a user correction that should be saved as a Playbook or Rule.

## 1. Playbook Operations (`agent-kernel evolve`)
- **Generate a Playbook from Current Workflow:**
  `agent-kernel evolve generate --title "Full Next.js Auth Setup" --topic "auth"`
- **List All Generated Playbooks:**
  `agent-kernel evolve list`
- **Inspect a Playbook & Evolution History:**
  `agent-kernel evolve inspect <playbookId>`
- **Evolve/Repair a Playbook:**
  `agent-kernel evolve repair <playbookId> --reason "Fixed Supabase redirect URL"`

## 2. Universal Self-Evolve Hooks (`agent-kernel evolve hooks`)
- **Install Hooks for Antigravity, Claude, Codex, OpenCode:**
  `agent-kernel evolve hooks`
- **Execute Hook Background Processing:**
  `agent-kernel hook self-evolve`
