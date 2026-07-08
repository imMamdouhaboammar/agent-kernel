# Windows compatibility test plan

Windows support should be verified explicitly.

## Required cases

1. npm exposes all binaries on PATH
2. `AGENT_KERNEL_HOME` works with Windows-style paths
3. generated files use portable path handling where possible
4. git hook behavior is documented if shell assumptions differ
5. tests run under a Windows CI job before full support is claimed

## Pass condition

Windows installability is proven before marketing full Windows parity.
