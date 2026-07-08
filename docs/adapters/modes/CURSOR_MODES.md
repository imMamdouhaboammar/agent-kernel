# Cursor mode mapping

## approval

Cursor writes pending proposals.

## trusted

Cursor may write project notes directly when using `agent-kernel-agent-write`.

## bypass

Cursor may write approved memory directly only after explicit bypass selection.

## Safety rule

Cursor rule files should tell Cursor to check the current mode before writing memory.
