# Internal runtime boundary

`dist/cli.mjs` remains the internal runtime CLI during the wrapper transition.

## Boundary

- wrapper owns public routing
- runtime owns core commands
- helpers own safe merge behavior
- tests prove public behavior

## Safety rule

Internal runtime behavior should not be treated as the public safety contract while wrapper routing is active.
