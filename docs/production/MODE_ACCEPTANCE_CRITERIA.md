# Mode acceptance criteria

## Required before production claim

- approval mode is default
- trusted mode cannot auto-write global critical memory
- bypass mode requires explicit selection
- mode helper is packaged
- agent write helper is packaged
- smoke tests cover all three modes

## Safety rule

Do not claim production-grade mode support until these criteria pass in CI.
