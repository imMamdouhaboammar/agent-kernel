#!/usr/bin/env sh
set -eu
agent-kernel-mode set trusted
agent-kernel-agent-write --from cursor --type project-note --scope project --level note --reason 'Project note' --text 'This repo uses pnpm.'
