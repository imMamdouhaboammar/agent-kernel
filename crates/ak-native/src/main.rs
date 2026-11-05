mod arch;
mod hook;
mod search;

use std::path::PathBuf;
use std::process;

const VERSION: &str = env!("CARGO_PKG_VERSION");

fn print_usage() {
    eprintln!(
        "ak-native {}\n\
        High-performance systems kernel for Agent Kernel\n\n\
        Usage:\n\
          ak-native hook context             Execute pre-tool context interceptor\n\
          ak-native arch scan [path]         Perform fast AST and import graph discovery\n\
          ak-native search <query> [--limit] Run ranked token search\n\
          ak-native doctor                   Display native engine status and paths\n\
          ak-native --version                Display version\n",
        VERSION
    );
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        print_usage();
        process::exit(1);
    }

    match args[1].as_str() {
        "--version" | "-v" | "version" => {
            println!("ak-native {VERSION}");
        }
        "-h" | "--help" | "help" => {
            print_usage();
        }
        "doctor" => {
            let home = hook::kernel_home();
            println!("ak-native {VERSION}");
            println!("Kernel home: {}", home.display());
            println!("Engine: Category C Systems Kernel (Rust/Native)");
            println!("Status: healthy");
        }
        "hook" => {
            if args.len() < 3 || args[2] != "context" {
                eprintln!("Usage: ak-native hook context");
                process::exit(1);
            }
            if let Err(err) = hook::handle_context_hook() {
                eprintln!("Hook error: {err}");
                process::exit(1);
            }
        }
        "arch" => {
            if args.len() < 3 || args[2] != "scan" {
                eprintln!("Usage: ak-native arch scan [path]");
                process::exit(1);
            }
            let target = if args.len() >= 4 {
                PathBuf::from(&args[3])
            } else {
                std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
            };

            match arch::discover_architecture(&target) {
                Ok(map) => {
                    let out =
                        serde_json::to_string_pretty(&map).unwrap_or_else(|_| "{}".to_string());
                    println!("{out}");
                }
                Err(err) => {
                    eprintln!("Architecture scan error: {err}");
                    process::exit(1);
                }
            }
        }
        "search" => {
            if args.len() < 3 {
                eprintln!("Usage: ak-native search <query> [--limit <n>]");
                process::exit(1);
            }
            let query = &args[2];
            let mut limit = 10;
            if args.len() >= 5 && args[3] == "--limit" {
                if let Ok(n) = args[4].parse() {
                    limit = n;
                }
            }
            let home = hook::kernel_home();
            let results = search::search(&home, query, limit);
            let out = serde_json::to_string_pretty(&results).unwrap_or_else(|_| "[]".to_string());
            println!("{out}");
        }
        other => {
            eprintln!("Unknown command: {other}");
            print_usage();
            process::exit(1);
        }
    }
}
