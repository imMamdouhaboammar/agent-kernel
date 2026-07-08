# Redaction rules

Agent Kernel should redact obvious secrets before storing memories, logs, or episodes.

## Redact examples

- OpenAI API keys
- Anthropic API keys
- Supabase service-role keys
- GitHub personal access tokens
- Google API keys
- Slack bot/user tokens
- `.env` assignment values

## Storage rule

If a value looks like a credential, store the fact that a credential was present, not the credential itself.

## Safety rule

Redaction should happen before writing to local logs or episode archives, not only before printing output.
