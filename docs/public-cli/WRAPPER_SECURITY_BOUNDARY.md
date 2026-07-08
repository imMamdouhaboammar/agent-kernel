# Wrapper security boundary

The wrapper is a routing layer, not a security engine.

## Responsibilities

- route high-risk public commands to safer implementations
- delegate non-routed commands unchanged
- preserve public command compatibility

## Non-responsibilities

- static analysis
- memory validation
- policy evaluation
- command sandboxing

## Safety rule

Security enforcement still belongs to guards, hooks, policies, and tests.
