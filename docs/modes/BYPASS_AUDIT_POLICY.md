# Bypass audit policy

Bypass mode should be fast but reviewable.

## Required audit concepts

- who selected bypass
- when bypass was selected
- which agent wrote memory
- what type of memory was written
- how many writes happened in the session

## Safety rule

Bypass mode should produce enough local evidence for a later cleanup pass.
