# Security notes

The scanner does not execute repository code. It caps file count and file size, normalizes paths, ignores generated and dependency directories by default, and stores evidence locally. Policies and exceptions are security-sensitive review artifacts and should be protected through normal code review.
