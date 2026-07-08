# Moded backward compatibility

Mode support must not break existing users.

## Guarantees

- `agent-kernel` stays the main CLI
- `ak` stays an alias
- existing proposal workflow remains valid
- missing mode config defaults to approval behavior
- package remains local-first

## Safety rule

New mode behavior should be additive unless a breaking release is declared.
