#!/usr/bin/env bash
# Agent Kernel Universal Auto-Installer — 1 Command to setup all AI agent governance.
set -euo pipefail

BOLD="\031[1m"
GREEN="\033[32m"
CYAN="\033[36m"
YELLOW="\033[33m"
RESET="\033[0m"

echo -e "${CYAN}${BOLD}🚀 Starting Agent Kernel Universal Installation...${RESET}\n"

# 1. Check Node.js / Bun
if command -v node >/dev/null 2>&1; range=$(node -v); echo "Found Node.js $range"; else
  if command -v bun >/dev/null 2>&1; then echo "Found Bun"; else
    echo "❌ Node.js (>=18.18.0) or Bun is required to install Agent Kernel."
    exit 1
  fi
fi

# 2. Install global package
echo -e "\n${BOLD}📦 Installing @mamdouh-aboammar/agent-kernel globally...${RESET}"
if command -v bun >/dev/null 2>&1; then
  bun install -g @mamdouh-aboammar/agent-kernel
elif command -v npm >/dev/null 2>&1; then
  npm install -g @mamdouh-aboammar/agent-kernel
fi

# 3. Execute setup command
echo -e "\n${BOLD}⚙️ Running Agent Kernel Universal Setup...${RESET}"
if command -v agent-kernel >/dev/null 2>&1; then
  agent-kernel setup
else
  npx -y @mamdouh-aboammar/agent-kernel setup
fi

echo -e "\n${GREEN}${BOLD}🎉 Agent Kernel Universal Setup Complete!${RESET}"
echo -e "Your AI coding agents now share memory, environment vault, and universal skills.\n"
