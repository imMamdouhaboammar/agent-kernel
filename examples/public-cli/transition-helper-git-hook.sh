#!/usr/bin/env sh
set -eu
# Transitional helper remains supported.
agent-kernel-safe-git-hook .
# Preferred production command:
agent-kernel git-hook install .
