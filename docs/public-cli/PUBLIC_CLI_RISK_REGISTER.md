# Public CLI risk register

| Risk | Mitigation |
| --- | --- |
| wrapper diverges from dist CLI | delegate all unrouted commands to `dist/cli.mjs` |
| safe behavior not used by users | route public commands to safe helpers |
| helper removal breaks users | keep helpers during transition |
| package bin target missing | protect with bin lint |

## Safety rule

Public command routing must improve behavior without breaking existing command names.
