# Approval release requirements

Approval mode is the release default.

## Requirements

- missing config behaves like approval
- helper creates pending proposals
- approval and rejection flows are tested
- docs mark approval as safest default
- package install does not silently select bypass

## Safety rule

Approval mode must remain the baseline for production installs.
