# Language support

The scanner recognizes common source files for JavaScript, TypeScript, Python, Go, Java, Ruby, PHP, C#, Rust, Kotlin, and Swift.

## Strongest support

Local dependency resolution is strongest for relative JavaScript and TypeScript imports, including common index resolution patterns.

## Partial support

Other languages contribute:

- source symbols
- external package or module references
- path and layer evidence
- file-level scope checks

Repository-specific aliases, generated code, macros, build-time code generation, reflection, and framework dependency injection may require explicit policy or a future adapter.

## Safe interpretation

Do not claim complete semantic understanding for a language based only on regex extraction. Deterministic path and import evidence can block; uncertain semantic conclusions should remain review hints.

Add language fixtures for both valid and invalid cases before increasing enforcement severity.
