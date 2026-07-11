# Hooks

`agent-kernel-architecture-hook` handles Claude `PreToolUse` payloads for Write, Edit, and MultiEdit. It checks file scope against the active change contract before the write.

The hook does not claim to validate future file content. Dependency and cycle checks run after content exists through `architecture check`. This separation avoids blocking a source file merely because its test will be written next.
