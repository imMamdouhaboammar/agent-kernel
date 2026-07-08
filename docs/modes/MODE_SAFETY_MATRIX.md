# Mode safety matrix

| Memory kind | approval | trusted | bypass |
| --- | --- | --- | --- |
| project note | pending | direct write | direct write |
| note-level preference | pending | direct write | direct write |
| standard global rule | pending | pending | direct write |
| critical rule | pending | pending | direct write |
| policy | pending | pending | direct write |

## Safety rule

Trusted mode must never auto-approve critical or global policy memory.
