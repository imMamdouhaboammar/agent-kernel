use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchRecord {
    pub id: String,
    #[serde(rename = "type")]
    pub record_type: String,
    pub source: String,
    pub status: Option<String>,
    pub title: String,
    pub text: String,
    pub files: Vec<String>,
    pub commands: Vec<String>,
    pub commits: Vec<String>,
    #[serde(rename = "errorSignature")]
    pub error_signature: String,
    pub tags: Vec<String>,
    pub project: String,
    pub agent: String,
    pub occurrences: u32,
    pub score: i32,
}

fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| {
            !c.is_alphanumeric() && c != '_' && c != '.' && c != '/' && c != ':' && c != '-'
        })
        .map(|s| s.trim_matches(|c: char| c == ':' || c == '.' || c == ',' || c == ';'))
        .filter(|s| s.len() > 1)
        .map(|s| s.to_string())
        .collect()
}

fn score_record(rec: &SearchRecord, query: &str) -> i32 {
    let terms = tokenize(query);
    if terms.is_empty() {
        return 0;
    }

    let query_lower = query.to_lowercase();
    let hay = format!("{} {} {}", rec.id, rec.title, rec.text).to_lowercase();
    let mut score = 0;

    for term in &terms {
        let mut matched = false;
        if hay.contains(term) {
            score += 3;
            matched = true;
        }
        if rec.files.iter().any(|f| f.to_lowercase().contains(term)) {
            score += 7;
            matched = true;
        }
        if rec.commands.iter().any(|c| c.to_lowercase().contains(term)) {
            score += 6;
            matched = true;
        }
        if rec.error_signature.to_lowercase().contains(term) {
            score += 8;
            matched = true;
        }
        if rec.tags.iter().any(|t| t.to_lowercase().contains(term)) {
            score += 4;
            matched = true;
        }
        if rec.project.to_lowercase().contains(term) {
            score += 3;
            matched = true;
        }
        if rec.agent.to_lowercase().contains(term) {
            score += 2;
            matched = true;
        }
        if rec.commits.iter().any(|c| c.to_lowercase().contains(term)) {
            score += 5;
            matched = true;
        }

        if !matched {
            return 0; // all terms must match at least one signal
        }
    }

    // Exact match bonuses
    if rec.files.iter().any(|f| f.to_lowercase() == query_lower) {
        score += 18;
    }
    if rec.commands.iter().any(|c| c.to_lowercase() == query_lower) {
        score += 16;
    }
    if !rec.error_signature.is_empty() && rec.error_signature.to_lowercase() == query_lower {
        score += 20;
    }
    if rec.tags.iter().any(|t| t.to_lowercase() == query_lower) {
        score += 10;
    }
    if !rec.project.is_empty() && rec.project.to_lowercase() == query_lower {
        score += 8;
    }

    if rec.record_type == "memory" && rec.status.as_deref() == Some("approved") {
        score += 6;
    }
    if rec.record_type == "failure" && rec.occurrences > 1 {
        score += rec.occurrences.min(10) as i32;
    }

    score
}

pub fn search(home: &Path, query: &str, limit: usize) -> Vec<SearchRecord> {
    let mut records = load_all_records(home);
    let mut results = Vec::new();

    for mut rec in records.drain(..) {
        let s = score_record(&rec, query);
        if s > 0 {
            rec.score = s;
            results.push(rec);
        }
    }

    results.sort_by(|a, b| b.score.cmp(&a.score));
    results.truncate(limit);
    results
}

fn load_all_records(home: &Path) -> Vec<SearchRecord> {
    let mut out = Vec::new();

    // 1. Memories
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
                                    if let Some(rec) =
                                        parse_record("memory", item, &path.to_string_lossy())
                                    {
                                        out.push(rec);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Failures
    let failures_file = home
        .join("source")
        .join("failures")
        .join("failure-lessons.json");
    if failures_file.is_file() {
        if let Ok(content) = fs::read_to_string(&failures_file) {
            if let Ok(val) = serde_json::from_str::<Value>(&content) {
                if let Some(arr) = val.as_array() {
                    for item in arr {
                        if let Some(rec) =
                            parse_record("failure", item, "source/failures/failure-lessons.json")
                        {
                            out.push(rec);
                        }
                    }
                }
            }
        }
    }

    // 3. Episodes
    let episodes_dir = home.join("episodes").join("archive");
    if episodes_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(episodes_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("json") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(val) = serde_json::from_str::<Value>(&content) {
                            if let Some(rec) =
                                parse_record("episode", &val, &path.to_string_lossy())
                            {
                                out.push(rec);
                            }
                        }
                    }
                }
            }
        }
    }

    out
}

fn parse_record(rec_type: &str, item: &Value, source: &str) -> Option<SearchRecord> {
    let id = item["id"]
        .as_str()
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("{rec_type}:{source}"));

    let title = item["title"]
        .as_str()
        .or_else(|| item["errorSignature"].as_str())
        .or_else(|| item["text"].as_str())
        .or_else(|| item["summary"].as_str())
        .unwrap_or("")
        .to_string();

    let text = item["text"]
        .as_str()
        .or_else(|| item["summary"].as_str())
        .or_else(|| item["rootCause"].as_str())
        .unwrap_or("")
        .to_string();

    let files = string_array(&item["files"]);
    let commands = string_array(&item["commands"]);
    let commits = string_array(&item["commits"]);
    let tags = string_array(&item["tags"]);

    let error_signature = item["errorSignature"].as_str().unwrap_or("").to_string();
    let project = item["project"]
        .as_str()
        .or_else(|| item["projectId"].as_str())
        .unwrap_or("")
        .to_string();
    let agent = item["agent"]
        .as_str()
        .or_else(|| item["agentId"].as_str())
        .unwrap_or("")
        .to_string();
    let occurrences = item["occurrences"].as_u64().unwrap_or(0) as u32;
    let status = item["status"].as_str().map(|s| s.to_string());

    Some(SearchRecord {
        id,
        record_type: rec_type.to_string(),
        source: source.to_string(),
        status,
        title,
        text,
        files,
        commands,
        commits,
        error_signature,
        tags,
        project,
        agent,
        occurrences,
        score: 0,
    })
}

fn string_array(val: &Value) -> Vec<String> {
    if let Some(arr) = val.as_array() {
        arr.iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect()
    } else if let Some(s) = val.as_str() {
        s.split(',')
            .map(|item| item.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    } else {
        Vec::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenize() {
        let tokens = tokenize("Error in src/app.ts: undefined symbol `foo`");
        assert!(tokens.contains(&"src/app.ts".to_string()));
        assert!(tokens.contains(&"error".to_string()));
        assert!(tokens.contains(&"symbol".to_string()));
    }

    #[test]
    fn test_score_record_exact_file() {
        let rec = SearchRecord {
            id: "mem1".to_string(),
            record_type: "memory".to_string(),
            source: "mem.json".to_string(),
            status: Some("approved".to_string()),
            title: "Rule".to_string(),
            text: "Use pnpm".to_string(),
            files: vec!["src/cli.mjs".to_string()],
            commands: vec![],
            commits: vec![],
            error_signature: String::new(),
            tags: vec![],
            project: String::new(),
            agent: String::new(),
            occurrences: 0,
            score: 0,
        };
        let score = score_record(&rec, "src/cli.mjs");
        // exact file (+18) + file match (+7) + approved (+6)
        assert!(score >= 25);
    }

    #[test]
    fn test_score_record_mismatch() {
        let rec = SearchRecord {
            id: "mem1".to_string(),
            record_type: "memory".to_string(),
            source: "mem.json".to_string(),
            status: None,
            title: "Rule".to_string(),
            text: "Use pnpm".to_string(),
            files: vec!["src/cli.mjs".to_string()],
            commands: vec![],
            commits: vec![],
            error_signature: String::new(),
            tags: vec![],
            project: String::new(),
            agent: String::new(),
            occurrences: 0,
            score: 0,
        };
        let score = score_record(&rec, "completely_unrelated_token");
        assert_eq!(score, 0);
    }
}
