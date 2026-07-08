# UserPromptSubmit contract

`UserPromptSubmit` is the capture point for explicit user memory instructions.

## Trigger examples

The hook may react to phrases such as:

```text
remember this
save this
add this as a rule
خلي دي rule
احفظ دي
احفظها لباقي agents
```

## Output

The hook should create a pending memory proposal, not an approved memory.

## Safety rule

The hook must not capture prompts containing the episodic exclusion marker or obvious secrets.
