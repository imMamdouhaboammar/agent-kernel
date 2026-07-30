---
name: agent-kernel-ops
description: Universal Agent Kernel operational guide for AI agents. Enables any agent (Claude, Antigravity, Cursor, Codex, Gemini, OpenCode) to seamlessly operate Agent Kernel environment vault, memory, policies, and health diagnostics.
---

# Agent Kernel Universal Operations Guide

This skill provides step-by-step instructions for AI agents to interact with Agent Kernel CLI and runtime seamlessly.

## Triggers & Trigger Phrases
Activate this skill when:
- The user mentions `agent-kernel`, `agy`, `.env`, `env-vault`, `memory proposal`, `agent rule`, or `policy`.
- You need to manage environment keys, check project status, or run policy/guard checks.

## 1. Environment Vault Management (`agent-kernel env`)
- **Link Project `.env` to Vault:**
  `agent-kernel env link [projectPath]`
- **Check Sync Status & Fingerprint:**
  `agent-kernel env status [projectPath]`
- **Auto-Sync / Force Push Edits:**
  `agent-kernel env push [projectPath]`
- **Restore Missing `.env` Keys:**
  `agent-kernel env pull [projectPath]`
- **List All Backed-Up Projects:**
  `agent-kernel env list`

## 2. Memory & Rule Proposals (`agent-kernel propose / approve`)
- **Propose a New Rule:**
  `agent-kernel propose --from <agentName> --text "Your rule text" --reason "Why"`
- **Inspect Inbox:**
  `agent-kernel inbox`
- **Approve Proposal:**
  `agent-kernel approve <proposalId> --publish`

## 3. Governance & Quality Guards (`agent-kernel guard / policy`)
- **Run File & Policy Guard:**
  `agent-kernel guard [--staged|--file path]`
- **Verify Policy Compliance:**
  `agent-kernel policy check mandatory-bun-package-manager`

## 4. Health & Context Diagnostics (`agent-kernel doctor / status`)
- **Check Kernel Status:**
  `agent-kernel status`
- **Run Health Doctor:**
  `agent-kernel doctor`
