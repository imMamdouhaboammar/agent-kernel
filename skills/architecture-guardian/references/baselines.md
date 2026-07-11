# Baselines

A baseline records architecture fingerprints and known finding fingerprints. It separates existing debt from regressions introduced by the current change.

Baselines must not normalize new violations into accepted architecture. Update a baseline only after reviewing the full report. A comment-only change must not turn an old cycle into a new finding.
