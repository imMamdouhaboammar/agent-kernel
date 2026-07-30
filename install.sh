#!/usr/bin/env bash
# Agent Kernel God Installer — 1 Command to rule them all.
# Installs Agent Kernel, compiles binaries, deploys all 18 Skills across Claude, Codex, Gemini, Antigravity, OpenCode, and registers universal hooks & env vault.

set -e

echo "🚀 Starting Agent Kernel 1-God Installation..."

# 1. Ensure Bun or Node is present
if command -v bun >/dev/null 2>&1; then
  PKG_MGR="bun"
elif command -v npm >/dev/null 2>&1; then
  PKG_MGR="npm"
else
  echo "❌ Error: Neither Bun nor Node/npm is installed. Please install Bun or Node.js first."
  exit 1
fi

echo "📦 Installing Agent Kernel globally via $PKG_MGR..."
if [ "$PKG_MGR" = "bun" ]; then
  bun install -g @mamdouh-aboammar/agent-kernel@latest || true
  bun link @mamdouh-aboammar/agent-kernel 2>/dev/null || true
else
  npm install -g @mamdouh-aboammar/agent-kernel@latest
fi

echo "⚙️ Running Agent Kernel Setup Engine..."
agent-kernel setup

echo ""
echo "🎉 Agent Kernel 1-God Setup Complete!"
echo "All 18 Skill Modules, Universal Hooks, Env Vault, and Runtime Doctor are active and synchronized across all AI Agent environments!"
