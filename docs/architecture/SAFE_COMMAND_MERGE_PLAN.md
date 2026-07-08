# Safe command merge plan

## Phase 1

Route public commands through wrapper to safe helpers.

## Phase 2

Move safe-link merge logic into core `link` implementation.

## Phase 3

Move safe-git-hook merge logic into core `git-hook install` implementation.

## Phase 4

Keep helpers as thin aliases or deprecate after migration window.

## Safety rule

Do not delete helper behavior before core runtime has equivalent tests.
