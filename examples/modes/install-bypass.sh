#!/usr/bin/env sh
set -eu
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel init --sync
agent-kernel-mode set bypass
agent-kernel doctor
printf '%s\n' 'Warning: bypass mode lets agents write approved memory directly.'
