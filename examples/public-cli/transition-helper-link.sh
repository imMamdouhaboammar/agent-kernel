#!/usr/bin/env sh
set -eu
# Transitional helper remains supported.
agent-kernel-safe-link .
# Preferred production command:
agent-kernel link .
