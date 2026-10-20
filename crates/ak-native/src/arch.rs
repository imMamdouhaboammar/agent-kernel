use ignore::WalkBuilder;
use regex::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct ArchNode {
    pub file: String,
    pub language: String,
    pub layer: Option<String>,
    pub symbols: Vec<String>,
    pub hash: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArchEdge {
    pub from: String,
    pub to: String,
    pub specifier: String,
    #[serde(rename = "fromLayer")]
    pub from_layer: Option<String>,
    #[serde(rename = "toLayer")]
    pub to_layer: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExternalImport {
    pub from: String,
    pub language: String,
    pub package: String,
    pub specifier: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArchitectureMap {
    pub version: u32,
    #[serde(rename = "generatedAt")]
    pub generated_at: String,
    pub root: String,
    #[serde(rename = "fileCount")]
    pub file_count: usize,
    pub languages: HashMap<String, usize>,
    #[serde(rename = "externalPackages")]
    pub external_packages: Vec<String>,
    #[serde(rename = "externalImports")]
    pub external_imports: Vec<ExternalImport>,
    pub nodes: Vec<ArchNode>,
    pub edges: Vec<ArchEdge>,
    pub cycles: Vec<Vec<String>>,
    pub fingerprint: String,
}

fn short_hash(input: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input);
    let result = hasher.finalize();
    hex::encode(&result[..8])
}

mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        let mut s = String::with_capacity(bytes.len() * 2);
        for &b in bytes {
            use std::fmt::Write;
            write!(&mut s, "{:02x}", b).unwrap();
        }
        s
    }
}

pub fn language_for_file(file: &str) -> &'static str {
    if file.ends_with(".ts") || file.ends_with(".tsx") {
        "typescript"
    } else if file.ends_with(".js")
        || file.ends_with(".mjs")
        || file.ends_with(".cjs")
        || file.ends_with(".jsx")
    {
        "javascript"
    } else if file.ends_with(".py") {
        "python"
    } else if file.ends_with(".rs") {
        "rust"
    } else if file.ends_with(".go") {
        "go"
    } else {
        "other"
    }
}

fn strip_js_comments(text: &str) -> String {
    static RE_BLOCK: std::sync::LazyLock<Regex> =
        std::sync::LazyLock::new(|| Regex::new(r"/\*[\s\S]*?\*/").unwrap());
    static RE_LINE: std::sync::LazyLock<Regex> =
        std::sync::LazyLock::new(|| Regex::new(r"(?m)^\s*//.*$").unwrap());

    let no_block = RE_BLOCK.replace_all(text, "");
    RE_LINE.replace_all(&no_block, "").to_string()
}

pub fn extract_imports(language: &str, text: &str) -> Vec<String> {
    static RE_JS_IMPORT: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
        Regex::new(r#"(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]"#).unwrap()
    });
    static RE_JS_REQUIRE: std::sync::LazyLock<Regex> =
        std::sync::LazyLock::new(|| Regex::new(r#"require\(\s*['"]([^'"]+)['"]\s*\)"#).unwrap());
    static RE_JS_DYNAMIC: std::sync::LazyLock<Regex> =
        std::sync::LazyLock::new(|| Regex::new(r#"import\(\s*['"]([^'"]+)['"]\s*\)"#).unwrap());
    static RE_PY_FROM: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
        Regex::new(r"(?m)^\s*from\s+([A-Za-z0-9_.]+)\s+import\s+").unwrap()
    });
    static RE_PY_IMPORT: std::sync::LazyLock<Regex> =
        std::sync::LazyLock::new(|| Regex::new(r"(?m)^\s*import\s+([A-Za-z0-9_.]+)").unwrap());

    let mut out = Vec::new();

    if language == "javascript" || language == "typescript" {
        let clean = strip_js_comments(text);
        for cap in RE_JS_IMPORT.captures_iter(&clean) {
            if let Some(m) = cap.get(1) {
                out.push(m.as_str().to_string());
            }
        }
        for cap in RE_JS_REQUIRE.captures_iter(&clean) {
            if let Some(m) = cap.get(1) {
                out.push(m.as_str().to_string());
            }
        }
        for cap in RE_JS_DYNAMIC.captures_iter(&clean) {
            if let Some(m) = cap.get(1) {
                out.push(m.as_str().to_string());
            }
        }
    } else if language == "python" {
        for cap in RE_PY_FROM.captures_iter(text) {
            if let Some(m) = cap.get(1) {
                out.push(m.as_str().to_string());
            }
        }
        for cap in RE_PY_IMPORT.captures_iter(text) {
            if let Some(m) = cap.get(1) {
                out.push(m.as_str().to_string());
            }
        }
    }

    out.sort();
    out.dedup();
    out
}

pub fn extract_symbols(language: &str, text: &str, file: &str) -> Vec<String> {
    static RE_JS_FN: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
        Regex::new(r"(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)").unwrap()
    });
    static RE_JS_CLASS: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
        Regex::new(r"(?:export\s+)?class\s+([A-Za-z_$][\w$]*)").unwrap()
    });
    static RE_JS_VAR: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
        Regex::new(r"(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=").unwrap()
    });
    static RE_PY_DEF: std::sync::LazyLock<Regex> =
        std::sync::LazyLock::new(|| Regex::new(r"(?m)^\s*def\s+([A-Za-z_]\w*)").unwrap());
    static RE_PY_CLASS: std::sync::LazyLock<Regex> =
        std::sync::LazyLock::new(|| Regex::new(r"(?m)^\s*class\s+([A-Za-z_]\w*)").unwrap());

    let mut out = Vec::new();

    if language == "javascript" || language == "typescript" {
        for cap in RE_JS_FN.captures_iter(text) {
            if let Some(m) = cap.get(1) {
                out.push(m.as_str().to_string());
            }
        }
        for cap in RE_JS_CLASS.captures_iter(text) {
            if let Some(m) = cap.get(1) {
                out.push(m.as_str().to_string());
            }
        }
        for cap in RE_JS_VAR.captures_iter(text) {
            if let Some(m) = cap.get(1) {
                out.push(m.as_str().to_string());
            }
        }
    } else if language == "python" {
        for cap in RE_PY_DEF.captures_iter(text) {
            if let Some(m) = cap.get(1) {
                out.push(m.as_str().to_string());
            }
        }
        for cap in RE_PY_CLASS.captures_iter(text) {
            if let Some(m) = cap.get(1) {
                out.push(m.as_str().to_string());
            }
        }
    }

    if out.is_empty() {
        if let Some(stem) = Path::new(file).file_stem().and_then(|s| s.to_str()) {
            out.push(stem.to_string());
        }
    }

    out.sort();
    out.dedup();
    out
}

fn package_name(specifier: &str, language: &str) -> Option<String> {
    if specifier.starts_with('.') || specifier.starts_with('/') || specifier.starts_with('#') {
        return None;
    }
    if language == "javascript" || language == "typescript" {
        if specifier.starts_with("node:") {
            return None;
        }
        let parts: Vec<&str> = specifier.split('/').collect();
        if specifier.starts_with('@') && parts.len() >= 2 {
            Some(format!("{}/{}", parts[0], parts[1]))
        } else if !parts.is_empty() {
            Some(parts[0].to_string())
        } else {
            None
        }
    } else if language == "python" {
        let first = specifier.split('.').next().unwrap_or("");
        Some(first.to_string())
    } else {
        None
    }
}

fn resolve_local_import(
    from_file: &str,
    specifier: &str,
    file_set: &HashSet<String>,
) -> Option<String> {
    if !specifier.starts_with('.') {
        return None;
    }
    let parent = Path::new(from_file)
        .parent()
        .unwrap_or_else(|| Path::new(""));
    let candidate = parent.join(specifier);
    let cand_str = candidate.to_string_lossy().replace('\\', "/");
    let norm = normalize_path_string(&cand_str);

    if file_set.contains(&norm) {
        return Some(norm);
    }

    let candidates = [
        format!("{norm}.ts"),
        format!("{norm}.js"),
        format!("{norm}.mjs"),
        format!("{norm}/index.ts"),
        format!("{norm}/index.js"),
    ];

    for c in &candidates {
        if file_set.contains(c) {
            return Some(c.clone());
        }
    }

    None
}

fn normalize_path_string(path_str: &str) -> String {
    let mut parts = Vec::new();
    for seg in path_str.split('/') {
        if seg == "." || seg.is_empty() {
            continue;
        } else if seg == ".." {
            parts.pop();
        } else {
            parts.push(seg);
        }
    }
    parts.join("/")
}

pub fn find_cycles(adjacency: &HashMap<String, Vec<String>>) -> Vec<Vec<String>> {
    let mut cycles = Vec::new();
    let mut state: HashMap<String, u8> = HashMap::new(); // 0 = unvisited, 1 = visiting, 2 = visited
    let mut path: Vec<String> = Vec::new();
    let mut positions: HashMap<String, usize> = HashMap::new();
    let mut signatures: HashSet<String> = HashSet::new();

    let mut start_nodes: Vec<String> = adjacency.keys().cloned().collect();
    start_nodes.sort();

    for start_node in start_nodes {
        if state.contains_key(&start_node) {
            continue;
        }

        struct Frame {
            node: String,
            index: usize,
            neighbors: Vec<String>,
        }

        let mut frames = Vec::new();
        state.insert(start_node.clone(), 1);
        positions.insert(start_node.clone(), path.len());
        path.push(start_node.clone());

        let mut neighbors = adjacency.get(&start_node).cloned().unwrap_or_default();
        neighbors.sort();
        frames.push(Frame {
            node: start_node,
            index: 0,
            neighbors,
        });

        while let Some(frame) = frames.last_mut() {
            if frame.index >= frame.neighbors.len() {
                let finished_node = frame.node.clone();
                frames.pop();
                path.pop();
                positions.remove(&finished_node);
                state.insert(finished_node, 2);
                continue;
            }

            let next = frame.neighbors[frame.index].clone();
            frame.index += 1;

            let s = state.get(&next).copied().unwrap_or(0);
            if s == 0 {
                state.insert(next.clone(), 1);
                positions.insert(next.clone(), path.len());
                path.push(next.clone());

                let mut next_neighbors = adjacency.get(&next).cloned().unwrap_or_default();
                next_neighbors.sort();
                frames.push(Frame {
                    node: next,
                    index: 0,
                    neighbors: next_neighbors,
                });
            } else if s == 1 {
                if let Some(&start_idx) = positions.get(&next) {
                    let mut cycle: Vec<String> = path[start_idx..].to_vec();
                    cycle.push(next.clone());

                    let sig = canonical_cycle_sig(&cycle);
                    if !signatures.contains(&sig) {
                        signatures.insert(sig);
                        cycles.push(cycle);
                    }
                }
            }
        }
    }

    cycles.sort_by(|a, b| a.join(" -> ").cmp(&b.join(" -> ")));
    cycles
}

fn canonical_cycle_sig(path: &[String]) -> String {
    if path.len() <= 1 {
        return String::new();
    }
    let nodes = &path[..path.len() - 1];
    let mut smallest = 0;
    for i in 1..nodes.len() {
        if nodes[i] < nodes[smallest] {
            smallest = i;
        }
    }
    let mut ordered = Vec::new();
    ordered.extend_from_slice(&nodes[smallest..]);
    ordered.extend_from_slice(&nodes[..smallest]);
    ordered.join(" -> ")
}

pub fn discover_architecture(root_dir: &Path) -> Result<ArchitectureMap, String> {
    let root_abs = root_dir.canonicalize().map_err(|e| e.to_string())?;
    let root_name = root_abs
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("project")
        .to_string();

    let mut walker = WalkBuilder::new(&root_abs);
    walker.standard_filters(true);
    walker.hidden(false);

    let mut relative_files = Vec::new();
    for result in walker.build() {
        let entry = result.map_err(|e| e.to_string())?;
        if entry.file_type().map_or(false, |ft| ft.is_file()) {
            let path = entry.path();
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if matches!(
                ext,
                "ts" | "tsx" | "js" | "mjs" | "cjs" | "jsx" | "py" | "go" | "rs"
            ) {
                if let Ok(rel) = path.strip_prefix(&root_abs) {
                    let rel_str = rel.to_string_lossy().replace('\\', "/");
                    if !rel_str.starts_with(".git/") && !rel_str.starts_with("node_modules/") {
                        relative_files.push(rel_str);
                    }
                }
            }
        }
    }

    relative_files.sort();
    let file_set: HashSet<String> = relative_files.iter().cloned().collect();

    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let mut external_imports = Vec::new();
    let mut adjacency: HashMap<String, Vec<String>> = HashMap::new();
    let mut languages: HashMap<String, usize> = HashMap::new();

    for file in &relative_files {
        adjacency.insert(file.clone(), Vec::new());
        let full_path = root_abs.join(file);
        let content = fs::read_to_string(&full_path).unwrap_or_default();
        let lang = language_for_file(file).to_string();
        *languages.entry(lang.clone()).or_insert(0) += 1;

        let hash = short_hash(content.as_bytes());
        let symbols = extract_symbols(&lang, &content, file);
        let imports = extract_imports(&lang, &content);

        nodes.push(ArchNode {
            file: file.clone(),
            language: lang.clone(),
            layer: None,
            symbols,
            hash,
        });

        for specifier in imports {
            if let Some(target) = resolve_local_import(file, &specifier, &file_set) {
                edges.push(ArchEdge {
                    from: file.clone(),
                    to: target.clone(),
                    specifier,
                    from_layer: None,
                    to_layer: None,
                });
                adjacency.get_mut(file).unwrap().push(target);
            } else if let Some(pkg) = package_name(&specifier, &lang) {
                external_imports.push(ExternalImport {
                    from: file.clone(),
                    language: lang.clone(),
                    package: pkg,
                    specifier,
                });
            }
        }
    }

    let mut external_packages: Vec<String> =
        external_imports.iter().map(|e| e.package.clone()).collect();
    external_packages.sort();
    external_packages.dedup();

    let cycles = find_cycles(&adjacency);

    let generated_at = chrono_now_iso();
    let file_count = nodes.len();

    let mut map = ArchitectureMap {
        version: 1,
        generated_at,
        root: root_name,
        file_count,
        languages,
        external_packages,
        external_imports,
        nodes,
        edges,
        cycles,
        fingerprint: String::new(),
    };

    let serialized = serde_json::to_string(&map.nodes).unwrap_or_default();
    map.fingerprint = short_hash(serialized.as_bytes());

    Ok(map)
}

fn chrono_now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}.{:03}Z", now.as_secs(), now.subsec_millis())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_language_for_file() {
        assert_eq!(language_for_file("app.ts"), "typescript");
        assert_eq!(language_for_file("index.js"), "javascript");
        assert_eq!(language_for_file("cli.mjs"), "javascript");
        assert_eq!(language_for_file("script.py"), "python");
        assert_eq!(language_for_file("main.rs"), "rust");
        assert_eq!(language_for_file("server.go"), "go");
        assert_eq!(language_for_file("doc.txt"), "other");
    }

    #[test]
    fn test_extract_imports_js() {
        let text = r#"
            // import fake from 'fake';
            /* import fake2 from 'fake2'; */
            import { foo } from './foo.js';
            const bar = require('bar-pkg');
            const dyn = import('./dynamic.js');
        "#;
        let mut imports = extract_imports("javascript", text);
        imports.sort();
        assert_eq!(imports, vec!["./dynamic.js", "./foo.js", "bar-pkg"]);
    }

    #[test]
    fn test_extract_imports_py() {
        let text = r#"
            # import fake
            import os
            from sys import argv
            from mypackage.sub import helper
        "#;
        let mut imports = extract_imports("python", text);
        imports.sort();
        assert_eq!(imports, vec!["mypackage.sub", "os", "sys"]);
    }

    #[test]
    fn test_find_cycles_detected() {
        let mut adj = HashMap::new();
        adj.insert("a".to_string(), vec!["b".to_string()]);
        adj.insert("b".to_string(), vec!["c".to_string()]);
        adj.insert("c".to_string(), vec!["a".to_string()]);

        let cycles = find_cycles(&adj);
        assert_eq!(cycles.len(), 1);
        assert_eq!(cycles[0], vec!["a", "b", "c", "a"]);
    }

    #[test]
    fn test_find_cycles_acyclic() {
        let mut adj = HashMap::new();
        adj.insert("a".to_string(), vec!["b".to_string()]);
        adj.insert("b".to_string(), vec!["c".to_string()]);
        adj.insert("c".to_string(), vec![]);

        let cycles = find_cycles(&adj);
        assert!(cycles.is_empty());
    }

    #[test]
    fn test_package_name_resolution() {
        assert_eq!(
            package_name("@scope/pkg/sub", "javascript"),
            Some("@scope/pkg".to_string())
        );
        assert_eq!(
            package_name("express", "javascript"),
            Some("express".to_string())
        );
        assert_eq!(package_name("node:fs", "javascript"), None);
        assert_eq!(package_name("./local", "javascript"), None);
    }
}
