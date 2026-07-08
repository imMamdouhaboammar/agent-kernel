#!/usr/bin/env sh
set -eu
agent-kernel-mode set approval
agent-kernel-agent-write --from codex --reason 'User asked to remember this' --text 'Use pnpm for this repository.'
agent-kernel inbox
