#!/usr/bin/env sh
set -eu
agent-kernel-mode set bypass
agent-kernel-agent-write --from opencode --type rule --level standard --reason 'Bypass session' --text 'Use small reviewable patches.'
