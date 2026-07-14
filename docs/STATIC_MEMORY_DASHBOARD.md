# Static Memory Dashboard

`agent-kernel dashboard` creates a read-only local HTML snapshot of the state already stored by Agent Kernel and opens it in the operating system browser.

The dashboard is optional. It does not require the daemon, a local server, a frontend dependency, an account, or a network connection.

## Generate and open

```bash
agent-kernel dashboard
```

The default file is atomically replaced at:

```text
~/.agent-kernel/reports/dashboard.html
```

Generate without opening, choose another output, or request structured CLI output:

```bash
agent-kernel dashboard --no-open
agent-kernel dashboard --out ./agent-kernel-dashboard.html --no-open
agent-kernel dashboard --json
agent-kernel dashboard --json --open
agent-kernel dashboard --project /path/to/repository
```

Human mode opens the browser by default. JSON mode generates only unless `--open` is supplied. `--open` and `--no-open` cannot be combined.

## What it displays

The page is adaptive. Empty sections are omitted. Known sections include:

- pending, approved, and rejected proposal history
- durable memories
- rules and skill triggers
- policies
- episodes
- Failure Lessons
- runtime session metadata
- registered agents and projects
- commit links
- updater status
- retention summary
- bounded audit history
- selected-project Architecture Guardian summary

Raw observations, environment variables, npm output, hook payloads, repository source, complete audit metadata, and updater audit logs are not embedded.

## Pending review workflow

A pending proposal with a safe ID can display copy-only controls for:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
agent-kernel reject <proposal-id>
```

The browser does not execute these commands. The user still reviews and runs the chosen action through a terminal or connected agent. Unsafe IDs receive no action controls.

## Browser boundary

The generated page is a local static file. Its inline JavaScript is restricted to:

- filtering already-rendered cards
- moving between local sections
- copying already-rendered IDs or commands
- showing temporary copy feedback

The page does not use `fetch`, XMLHttpRequest, WebSocket, EventSource, forms, localhost APIs, custom command protocols, external scripts, external stylesheets, analytics, or remote assets.

A restrictive Content Security Policy permits only the inline style and copy/filter script shipped inside the file.

## Privacy and storage safety

Before rendering, Agent Kernel:

- applies secret-pattern and sensitive-key redaction
- HTML-escapes dynamic text and attributes
- replaces absolute Agent Kernel and project paths with neutral labels
- reduces Architecture Guardian state to counts and reviewed metadata
- reduces audit rows to operation, actor category, target type, timestamp, and compact summary
- skips malformed optional JSON files and reports a generic count
- preserves malformed central configuration instead of replacing it

Output safety:

- existing symbolic output targets are rejected
- existing directory or other non-regular targets are rejected
- symbolic existing parent directories are rejected
- the file is written through atomic replacement
- browser-open failure preserves the generated file

Each successful generation appends one bounded, redacted `dashboard.generate` entry to `~/.agent-kernel/logs/audit.jsonl`. The dashboard does not modify memory, proposal lifecycle, policy, episode, registry, session, or commit-link stores.

## Browser selection

Agent Kernel uses argument-array process execution without a shell:

- macOS: `open`
- Linux and other Unix systems: `xdg-open`
- Windows: `rundll32.exe url.dll,FileProtocolHandler`

If no browser opener is available, the CLI reports a bounded category and leaves the HTML file ready to open manually.

## Dashboard versus report

```bash
agent-kernel dashboard
agent-kernel report ./agent-kernel-report.html
```

Use `dashboard` for adaptive browser inspection, search, and copy assistance. Use `report` for the older script-free compatibility report at an explicit path.

Neither command mutates durable memory or approves pending proposals.
