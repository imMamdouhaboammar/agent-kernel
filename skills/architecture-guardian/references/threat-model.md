# Threat model

Architecture Guardian assumes repository files may contain misleading names and generated code. It does not execute scanned source files. It reads bounded text files and uses deterministic regex extraction.

Primary risks are path traversal, secret leakage in reports, denial of service through very large trees, malicious policy changes, and false authority from heuristic findings. Mitigations include repository-relative paths, file count and size caps, local JSON storage, confidence gates, reviewed policy changes, and explicit exceptions.
