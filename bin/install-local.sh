#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18.18+ is required."
  exit 1
fi

npm link
agent-kernel init --sync --enforce
agent-kernel doctor
