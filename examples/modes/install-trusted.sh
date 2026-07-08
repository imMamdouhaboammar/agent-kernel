#!/usr/bin/env sh
set -eu
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel init --sync
agent-kernel-mode set trusted
agent-kernel doctor
