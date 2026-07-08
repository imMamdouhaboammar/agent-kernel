# npx one-off usage

Users should be able to inspect Agent Kernel without installing globally.

## Command

```bash
npx -y @mamdouh-aboammar/agent-kernel --version
npx -y @mamdouh-aboammar/agent-kernel doctor
```

## Purpose

One-off usage is useful for:

- checking package availability
- testing version output
- running setup in ephemeral environments

## Safety rule

One-off usage should not silently write project files unless the user runs an explicit write command.
