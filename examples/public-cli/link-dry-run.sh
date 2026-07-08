#!/usr/bin/env sh
set -eu
agent-kernel init --sync
agent-kernel link . --dry-run
