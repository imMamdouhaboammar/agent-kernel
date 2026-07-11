# False-positive control

Architecture findings require evidence and a confidence value. Findings below `confidenceThreshold` are discarded before reporting.

Deterministic imports, cycles, scope violations, and denied packages can block. Semantic similarity and abstraction quality should normally remain review findings. Baseline classification prevents old debt from being blamed on a new change.
