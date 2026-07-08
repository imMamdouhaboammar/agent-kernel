# Mode config test plan

## Cases

1. default mode is approval
2. `set approval` persists approval
3. `set trusted` persists trusted
4. `set bypass` persists bypass
5. invalid mode exits non-zero

## Pass condition

Mode config is predictable and never falls back to bypass on error.
