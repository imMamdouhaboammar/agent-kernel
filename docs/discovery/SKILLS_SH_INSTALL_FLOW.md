# Skills.sh install flow

Agent Kernel should be discoverable through Skills.sh.

## Discovery goal

An agent should be able to find the repo, read `SKILL.md`, and understand how to install and configure Agent Kernel.

## Expected flow

```bash
npx skills add imMamdouhaboammar/agent-kernel
```

Then the agent should guide the user through:

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel init --sync
agent-kernel-safe-link .
```

## Safety rule

Skills.sh discovery should install instructions and skills, not silently mutate user projects without explicit commands.
