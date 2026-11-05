use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};

const DEFAULT_BUDGET: usize = 1800;

pub fn kernel_home() -> PathBuf {
    if let Ok(val) = std::env::var("AGENT_KERNEL_HOME") {
        PathBuf::from(val)
    } else if let Some(home) = dirs_home() {
        home.join(".agent-kernel")
    } else {
        PathBuf::from(".agent-kernel")
    }
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

pub fn redact_secrets(input: &str) -> String {
    static RE_OPENAI: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
        Regex::new(r#"(?i)OPENAI_API_KEY\s*=\s*["'][^"']+["']"#).unwrap()
    });
    static RE_ANTHROPIC: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
        Regex::new(r#"(?i)ANTHROPIC_API_KEY\s*=\s*["'][^"']+["']"#).unwrap()
    });
    static RE_SUPABASE: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
        Regex::new(r#"(?i)SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']"#).unwrap()
    });
    static RE_AIZA: std::sync::LazyLock<Regex> =
        std::sync::LazyLock::new(|| Regex::new(r"AIza[0-9A-Za-z\-_]{35}").unwrap());
    static RE_SK: std::sync::LazyLock<Regex> =
        std::sync::LazyLock::new(|| Regex::new(r"sk-(?:proj-)?[A-Za-z0-9_-]{20,}").unwrap());
    static RE_GHP: std::sync::LazyLock<Regex> =
        std::sync::LazyLock::new(|| Regex::new(r"ghp_[A-Za-z0-9]{20,}").unwrap());
    static RE_PAT: std::sync::LazyLock<Regex> =
        std::sync::LazyLock::new(|| Regex::new(r"github_pat_[A-Za-z0-9_]{20,}").unwrap());
    static RE_SLACK: std::sync::LazyLock<Regex> =
        std::sync::LazyLock::new(|| Regex::new(r"xox[abposr]-[A-Za-z0-9-]{10,}").unwrap());

    let mut res = input.to_string();
    res = RE_OPENAI.replace_all(&res, "[REDACTED_SECRET]").to_string();
    res = RE_ANTHROPIC
        .replace_all(&res, "[REDACTED_SECRET]")
        .to_string();
    res = RE_SUPABASE
        .replace_all(&res, "[REDACTED_SECRET]")
        .to_string();
    res = RE_AIZA.replace_all(&res, "[REDACTED_SECRET]").to_string();
    res = RE_SK.replace_all(&res, "[REDACTED_SECRET]").to_string();
    res = RE_GHP.replace_all(&res, "[REDACTED_SECRET]").to_string();
    res = RE_PAT.replace_all(&res, "[REDACTED_SECRET]").to_string();
    res = RE_SLACK.replace_all(&res, "[REDACTED_SECRET]").to_string();
    res
}

#[derive(Debug, Deserialize)]
struct HookPayload {
    #[serde(alias = "tool_name", default)]
    tool_name: String,
    #[serde(alias = "toolName", default)]
    tool_name_alt: String,
    #[serde(alias = "tool_input", default)]
    tool_input: Value,
    #[serde(alias = "toolInput", default)]
    tool_input_alt: Value,
    #[serde(default)]
    command: Option<String>,
    #[serde(default)]
    files: Option<Vec<String>>,
}

fn collect_files(payload: &HookPayload) -> Vec<String> {
    let mut out = Vec::new();
    let input = if !payload.tool_input.is_null() {
        &payload.tool_input
    } else {
        &payload.tool_input_alt
    };

    let push_val = |v: &Value, out: &mut Vec<String>| {
        if let Some(s) = v.as_str() {
            out.push(s.replace('\\', "/").trim().to_string());
        } else if let Some(arr) = v.as_array() {
            for item in arr {
                if let Some(s) = item.as_str() {
                    out.push(s.replace('\\', "/").trim().to_string());
                }
            }
        }
    };

    push_val(&input["file_path"], &mut out);
    push_val(&input["filePath"], &mut out);
    push_val(&input["path"], &mut out);
    push_val(&input["filename"], &mut out);
    push_val(&input["files"], &mut out);
    push_val(&input["paths"], &mut out);

    if let Some(ref list) = payload.files {
        for f in list {
            out.push(f.replace('\\', "/").trim().to_string());
        }
    }

    out.retain(|s| !s.is_empty());
    out.sort();
    out.dedup();
    out
}

fn collect_command(payload: &HookPayload) -> String {
    let input = if !payload.tool_input.is_null() {
        &payload.tool_input
    } else {
        &payload.tool_input_alt
    };

    if let Some(cmd) = input["command"].as_str() {
        return cmd.to_string();
    }
    if let Some(ref cmd) = payload.command {
        return cmd.clone();
    }
    String::new()
}

#[derive(Serialize)]
struct HookResponse {
    #[serde(rename = "hookSpecificOutput")]
    hook_specific_output: HookSpecificOutput,
}

#[derive(Serialize)]
struct HookSpecificOutput {
    #[serde(rename = "hookEventName")]
    hook_event_name: String,
    #[serde(rename = "additionalContext")]
    additional_context: String,
}

pub fn handle_context_hook() -> io::Result<()> {
    let mut buffer = String::new();
    io::stdin().read_to_string(&mut buffer)?;

    let payload: HookPayload = match serde_json::from_str(&buffer) {
        Ok(p) => p,
        Err(_) => {
            println!("{{}}");
            return Ok(());
        }
    };

    let tool = if !payload.tool_name.is_empty() {
        &payload.tool_name
    } else {
        &payload.tool_name_alt
    };

    let is_risky = matches!(tool.as_str(), "Edit" | "MultiEdit" | "Write" | "Bash");
    if !is_risky {
        println!("{{}}");
        return Ok(());
    }

    let files = collect_files(&payload);
    let command = collect_command(&payload);

    if files.is_empty() && tool == "Bash" && command.is_empty() {
        println!("{{}}");
        return Ok(());
    }

    let home = kernel_home();
    let budget = std::env::var("AGENT_KERNEL_BUDGET")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(DEFAULT_BUDGET);

    let context = build_context_fast(&home, &files, &command, budget);
    if context.is_empty() {
        println!("{{}}");
        return Ok(());
    }

    let resp = HookResponse {
        hook_specific_output: HookSpecificOutput {
            hook_event_name: "PreToolUse".to_string(),
            additional_context: redact_secrets(&format!(
                "Agent Kernel local context before {tool}:\n{context}"
            )),
        },
    };

    let out = serde_json::to_string(&resp).unwrap_or_else(|_| "{}".to_string());
    println!("{out}");
    Ok(())
}

fn build_context_fast(home: &Path, files: &[String], command: &str, budget: usize) -> String {
    let mut rules = Vec::new();
    let mut failures = Vec::new();
    let mut episodes = Vec::new();

    let query_lower = command.to_lowercase();
    let file_lowers: Vec<String> = files.iter().map(|f| f.to_lowercase()).collect();

    // 1. Approved memory rules
    let memories_dir = home.join("source").join("memories");
    if memories_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(memories_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("json") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(val) = serde_json::from_str::<Value>(&content) {
                            if let Some(arr) = val.as_array() {
                                for item in arr {
                                    if item["status"].as_str() == Some("approved") {
                                        if let Some(text) = item["text"].as_str() {
                                            rules.push(text.to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Failure lessons
    let failure_file = home
        .join("source")
        .join("failures")
        .join("failure-lessons.json");
    if failure_file.is_file() {
        if let Ok(content) = fs::read_to_string(failure_file) {
            if let Ok(val) = serde_json::from_str::<Value>(&content) {
                if let Some(arr) = val.as_array() {
                    for item in arr {
                        let text = item["rootCause"]
                            .as_str()
                            .or_else(|| item["fix"].as_str())
                            .or_else(|| item["text"].as_str());
                        if let Some(t) = text {
                            let item_str = item.to_string().to_lowercase();
                            let mut score = 0;
                            if !query_lower.is_empty() && item_str.contains(&query_lower) {
                                score += 4;
                            }
                            for fl in &file_lowers {
                                if item_str.contains(fl) {
                                    score += 6;
                                }
                            }
                            if score > 0 || (query_lower.is_empty() && file_lowers.is_empty()) {
                                failures.push((score, t.to_string()));
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort failures by relevance
    failures.sort_by(|a, b| b.0.cmp(&a.0));

    // 3. Episodes
    let episodes_dir = home.join("episodes").join("archive");
    if episodes_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(episodes_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("json") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(val) = serde_json::from_str::<Value>(&content) {
                            let title = val["title"].as_str().or_else(|| val["summary"].as_str());
                            if let Some(t) = title {
                                episodes.push(t.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    let mut lines = Vec::new();
    if !rules.is_empty() {
        lines.push("## Approved Rules".to_string());
        for r in rules.iter().take(5) {
            lines.push(format!("- {r}"));
        }
        lines.push(String::new());
    }

    if !failures.is_empty() {
        lines.push("## Failure Lessons".to_string());
        for (_, f) in failures.iter().take(5) {
            lines.push(format!("- {f}"));
        }
        lines.push(String::new());
    }

    if !episodes.is_empty() {
        lines.push("## Related Episodes".to_string());
        for e in episodes.iter().take(3) {
            lines.push(format!("- {e}"));
        }
        lines.push(String::new());
    }

    let full = lines.join("\n").trim().to_string();
    if full.len() > budget {
        full[..budget].to_string()
    } else {
        full
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_redact_secrets() {
        let text = "OPENAI_API_KEY=\"sk-proj-1234567890abcdef1234\" ANTHROPIC_API_KEY='sk-ant-1234567890abcdef1234'";
        let redacted = redact_secrets(text);
        assert!(!redacted.contains("sk-proj-"));
        assert!(!redacted.contains("sk-ant-"));
        assert!(redacted.contains("[REDACTED_SECRET]"));
    }

    #[test]
    fn test_collect_files_dedup() {
        let payload = HookPayload {
            tool_name: "Edit".to_string(),
            tool_name_alt: String::new(),
            tool_input: json!({ "file_path": "src/cli.mjs", "paths": ["src/app.ts", "src/cli.mjs"] }),
            tool_input_alt: Value::Null,
            command: None,
            files: None,
        };
        let files = collect_files(&payload);
        assert_eq!(files, vec!["src/app.ts", "src/cli.mjs"]);
    }

    #[test]
    fn test_collect_command() {
        let payload = HookPayload {
            tool_name: "Bash".to_string(),
            tool_name_alt: String::new(),
            tool_input: json!({ "command": "git status" }),
            tool_input_alt: Value::Null,
            command: None,
            files: None,
        };
        assert_eq!(collect_command(&payload), "git status");
    }
}
