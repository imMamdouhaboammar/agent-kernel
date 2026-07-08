# Episodic memory privacy

Episodic memory can help agents recall previous decisions, but it can also store sensitive conversation text.

## Risks

- raw client information
- credentials accidentally pasted into chat
- private file paths
- rejected architecture that should not be reused globally
- long transcripts with mixed sensitive and useful content

## Required behavior

- support a do-not-index marker
- prefer summaries over raw transcripts where possible
- allow dry-run sync before saving episodes
- redact obvious secrets before storing text
- keep the archive local by default

## Safety rule

Episodic memory should be useful for recall without becoming an uncontrolled transcript dump.
