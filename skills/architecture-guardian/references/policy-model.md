# Policy model

The project policy lives at `.agent-kernel/architecture/policy.json`.

Deterministic policy fields include layer boundaries, forbidden dependency pairs, denied or allowlisted packages, cycle enforcement, confidence threshold, blocking severities, maximum files per change, and contract requirements.

`review` mode reports findings. `strict` mode is intended for hooks and CI. Findings marked `block` only fail when their severity is present in `blockOn` and they are new relative to the baseline.
