# Wrapper failure policy

The public CLI wrapper should fail clearly.

## Required behavior

- propagate child process exit status
- print child process errors
- fail non-zero when safe command execution fails
- never continue to hook install if link failed

## Safety rule

A failed safe link must stop the workflow before additional project mutation.
