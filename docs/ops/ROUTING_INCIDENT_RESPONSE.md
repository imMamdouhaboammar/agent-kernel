# Routing incident response

Use this when public commands behave unsafely.

## Steps

1. stop using the affected command
2. inspect backups
3. restore user-owned files if needed
4. run wrapper smoke tests
5. block release until routing is fixed

## Safety rule

Unsafe routing behavior is a release blocker.
