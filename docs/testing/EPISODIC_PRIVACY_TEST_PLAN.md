# Episodic privacy test plan

Episode sync must avoid turning private transcripts into uncontrolled memory.

## Required cases

1. do-not-index marker skips capture
2. obvious secret patterns are redacted or blocked
3. sync limit is respected
4. episode index can be rebuilt
5. episode search does not expose more text than needed

## Pass condition

Episodic memory remains local, bounded, and respectful of exclusion markers.
