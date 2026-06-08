//! PI Coding Agent execution engine.

use super::types::{ContentBlock, ToolCall, UsageData};
use crate::http_server::EmitExt;
use crate::platform::silent_command;
use serde_json::Value;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::process::Stdio;
use tauri::AppHandle;

pub struct PiResponse {
    pub content: String,
    pub session_id: String,
    pub tool_calls: Vec<ToolCall>,
    pub content_blocks: Vec<ContentBlock>,
    pub cancelled: bool,
    pub usage: Option<UsageData>,
}

#[derive(serde::Serialize, Clone)]
struct ChunkEvent {
    session_id: String,
    worktree_id: String,
    content: String,
}

#[derive(serde::Serialize, Clone)]
struct ToolUseEvent {
    session_id: String,
    worktree_id: String,
    id: String,
    name: String,
    input: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    parent_tool_use_id: Option<String>,
}

#[derive(serde::Serialize, Clone)]
struct ToolBlockEvent {
    session_id: String,
    worktree_id: String,
    tool_call_id: String,
}

#[derive(serde::Serialize, Clone)]
struct ToolResultEvent {
    session_id: String,
    worktree_id: String,
    tool_use_id: String,
    output: String,
}

#[derive(serde::Serialize, Clone)]
struct ThinkingEvent {
    session_id: String,
    worktree_id: String,
    content: String,
}

#[derive(serde::Serialize, Clone)]
struct DoneEvent {
    session_id: String,
    worktree_id: String,
    waiting_for_plan: bool,
}

#[derive(serde::Serialize, Clone)]
pub struct ErrorEvent {
    pub session_id: String,
    pub worktree_id: String,
    pub error: String,
}

fn normalize_tool_name(name: &str) -> String {
    match name {
        "read" => "Read",
        "write" => "Write",
        "edit" => "Edit",
        "bash" | "shell" | "terminal" => "Bash",
        "grep" | "search" => "Grep",
        "find" | "glob" | "ls" | "list" => "Glob",
        other => other,
    }
    .to_string()
}

fn usage_from_value(value: &Value) -> Option<UsageData> {
    let usage = value.get("usage").or_else(|| value.get("token_usage"))?;
    Some(UsageData {
        input_tokens: usage
            .get("input_tokens")
            .or_else(|| usage.get("inputTokens"))
            .or_else(|| usage.get("input"))
            .and_then(Value::as_u64)
            .unwrap_or(0),
        output_tokens: usage
            .get("output_tokens")
            .or_else(|| usage.get("outputTokens"))
            .or_else(|| usage.get("output"))
            .and_then(Value::as_u64)
            .unwrap_or(0),
        cache_read_input_tokens: usage
            .get("cache_read_input_tokens")
            .or_else(|| usage.get("cacheReadInputTokens"))
            .or_else(|| usage.get("cacheRead"))
            .and_then(Value::as_u64)
            .unwrap_or(0),
        cache_creation_input_tokens: usage
            .get("cache_creation_input_tokens")
            .or_else(|| usage.get("cacheCreationInputTokens"))
            .or_else(|| usage.get("cacheWrite"))
            .and_then(Value::as_u64)
            .unwrap_or(0),
    })
}

fn iter_content_blocks(value: &Value) -> impl Iterator<Item = &Value> {
    value
        .get("content")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
}

fn text_content_from_blocks(value: &Value) -> String {
    iter_content_blocks(value)
        .filter(|block| block.get("type").and_then(Value::as_str) == Some("text"))
        .filter_map(|block| block.get("text").and_then(Value::as_str))
        .collect::<Vec<_>>()
        .join("")
}

fn text_delta_from_value(value: &Value) -> Option<&str> {
    value
        .get("assistantMessageEvent")
        .and_then(|event| {
            if event.get("type").and_then(Value::as_str) == Some("text_delta") {
                event.get("delta").and_then(Value::as_str)
            } else {
                None
            }
        })
        .or_else(|| {
            value.get("delta").and_then(|d| {
                if d.get("type").and_then(Value::as_str) == Some("text_delta") {
                    d.get("text").and_then(Value::as_str)
                } else {
                    d.as_str()
                }
            })
        })
        .or_else(|| value.get("text").and_then(Value::as_str))
}

fn message_usage_from_value(value: &Value) -> Option<UsageData> {
    value.get("message").and_then(usage_from_value)
}

fn parse_pi_json_stream_inner(input: &str) -> PiResponse {
    let mut content = String::new();
    let mut session_id = String::new();
    let mut tool_calls = Vec::new();
    let mut content_blocks = Vec::new();
    let mut usage = None;

    for line in input.lines().map(str::trim).filter(|line| !line.is_empty()) {
        let Ok(value) = serde_json::from_str::<Value>(line) else {
            continue;
        };

        if let Some(id) = value
            .get("session_id")
            .or_else(|| value.get("sessionId"))
            .or_else(|| {
                if value.get("type").and_then(Value::as_str) == Some("session") {
                    value.get("id")
                } else {
                    None
                }
            })
            .and_then(Value::as_str)
        {
            if !id.is_empty() {
                session_id = id.to_string();
            }
        }

        let event_type = value.get("type").and_then(Value::as_str).unwrap_or("");
        match event_type {
            "message" => {
                let Some(message) = value.get("message") else {
                    continue;
                };
                match message.get("role").and_then(Value::as_str) {
                    Some("assistant") => {
                        for block in iter_content_blocks(message) {
                            match block.get("type").and_then(Value::as_str) {
                                Some("text") => {
                                    if let Some(text) = block.get("text").and_then(Value::as_str) {
                                        content.push_str(text);
                                        content_blocks.push(ContentBlock::Text {
                                            text: text.to_string(),
                                        });
                                    }
                                }
                                Some("thinking") => {
                                    if let Some(thinking) =
                                        block.get("thinking").and_then(Value::as_str)
                                    {
                                        content_blocks.push(ContentBlock::Thinking {
                                            thinking: thinking.to_string(),
                                        });
                                    }
                                }
                                Some("toolCall") => {
                                    let id = block
                                        .get("id")
                                        .and_then(Value::as_str)
                                        .unwrap_or("")
                                        .to_string();
                                    if id.is_empty() {
                                        continue;
                                    }
                                    let raw_name =
                                        block.get("name").and_then(Value::as_str).unwrap_or("");
                                    let input = block
                                        .get("arguments")
                                        .or_else(|| block.get("input"))
                                        .cloned()
                                        .unwrap_or(Value::Null);
                                    tool_calls.push(ToolCall {
                                        id: id.clone(),
                                        name: normalize_tool_name(raw_name),
                                        input,
                                        output: None,
                                        parent_tool_use_id: None,
                                    });
                                    content_blocks.push(ContentBlock::ToolUse { tool_call_id: id });
                                }
                                _ => {}
                            }
                        }
                        if let Some(next_usage) = usage_from_value(message) {
                            usage = Some(next_usage);
                        }
                    }
                    Some("toolResult") => {
                        let id = message
                            .get("toolCallId")
                            .or_else(|| message.get("tool_call_id"))
                            .and_then(Value::as_str)
                            .unwrap_or("");
                        let output = text_content_from_blocks(message);
                        if let Some(tool) = tool_calls.iter_mut().find(|tool| tool.id == id) {
                            tool.output = Some(output);
                        }
                    }
                    _ => {}
                }
            }
            "message_update" | "assistant" => {
                if value.get("role").and_then(Value::as_str) != Some("user") {
                    if let Some(text) = text_delta_from_value(&value) {
                        content.push_str(text);
                        content_blocks.push(ContentBlock::Text {
                            text: text.to_string(),
                        });
                    }
                }
            }
            "tool_execution_start" | "tool_call" => {
                let id = value
                    .get("id")
                    .or_else(|| value.get("tool_use_id"))
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                if id.is_empty() {
                    continue;
                }
                let raw_name = value
                    .get("name")
                    .or_else(|| value.get("tool_name"))
                    .and_then(Value::as_str)
                    .unwrap_or("");
                let input = value
                    .get("input")
                    .or_else(|| value.get("args"))
                    .cloned()
                    .unwrap_or(Value::Null);
                tool_calls.push(ToolCall {
                    id: id.clone(),
                    name: normalize_tool_name(raw_name),
                    input,
                    output: None,
                    parent_tool_use_id: None,
                });
                content_blocks.push(ContentBlock::ToolUse { tool_call_id: id });
            }
            "tool_execution_end" | "tool_result" => {
                let id = value
                    .get("id")
                    .or_else(|| value.get("tool_use_id"))
                    .and_then(Value::as_str)
                    .unwrap_or("");
                let output = value
                    .get("output")
                    .or_else(|| value.get("result"))
                    .or_else(|| value.get("content"))
                    .map(|v| {
                        v.as_str()
                            .map(ToOwned::to_owned)
                            .unwrap_or_else(|| v.to_string())
                    })
                    .unwrap_or_default();
                if let Some(tool) = tool_calls.iter_mut().find(|tool| tool.id == id) {
                    tool.output = Some(output);
                }
            }
            "message_end" | "turn_end" => {
                if let Some(next_usage) = message_usage_from_value(&value) {
                    usage = Some(next_usage);
                }
            }
            "agent_end" | "result" => {
                if let Some(next_usage) = usage_from_value(&value) {
                    usage = Some(next_usage);
                }
            }
            _ => {}
        }
    }

    PiResponse {
        content,
        session_id,
        tool_calls,
        content_blocks,
        cancelled: false,
        usage,
    }
}

fn raw_pi_model(model: Option<&str>) -> Option<&str> {
    model.map(|m| m.strip_prefix("pi/").unwrap_or(m))
}

fn pi_thinking_level(effort: Option<&super::types::EffortLevel>) -> Option<&'static str> {
    match effort {
        Some(super::types::EffortLevel::Off) => Some("off"),
        Some(super::types::EffortLevel::Minimal) => Some("minimal"),
        Some(super::types::EffortLevel::Low) => Some("low"),
        Some(super::types::EffortLevel::Medium) => Some("medium"),
        Some(super::types::EffortLevel::High) => Some("high"),
        Some(super::types::EffortLevel::Xhigh)
        | Some(super::types::EffortLevel::Max)
        | Some(super::types::EffortLevel::Ultracode) => Some("xhigh"),
        None => None,
    }
}

fn pi_tools_for_mode(mode: &str) -> &'static str {
    match mode {
        "plan" => "read,grep,find,ls",
        "build" => "read,grep,find,ls,edit,write",
        _ => "all",
    }
}

fn append_system_prompt_arg(args: &mut Vec<String>, system_prompt: Option<&str>) {
    if let Some(prompt) = system_prompt.map(str::trim).filter(|s| !s.is_empty()) {
        args.push("--append-system-prompt".into());
        args.push(prompt.to_string());
    }
}

fn parse_pi_stream<R: BufRead>(
    app: Option<&AppHandle>,
    session_id: &str,
    worktree_id: &str,
    reader: R,
) -> Result<PiResponse, String> {
    let mut raw = String::new();
    let mut response = PiResponse {
        content: String::new(),
        session_id: String::new(),
        tool_calls: Vec::new(),
        content_blocks: Vec::new(),
        cancelled: false,
        usage: None,
    };

    for line in reader.lines() {
        let line = line.map_err(|e| format!("Failed to read PI output: {e}"))?;
        raw.push_str(&line);
        raw.push('\n');
        let Ok(value) = serde_json::from_str::<Value>(&line) else {
            continue;
        };

        let before_content_len = response.content.len();
        let before_tool_count = response.tool_calls.len();
        response = parse_pi_json_stream_inner(&raw);

        if let Some(app) = app {
            if response.content.len() > before_content_len {
                let content = response.content[before_content_len..].to_string();
                let _ = app.emit_all(
                    "chat:chunk",
                    &ChunkEvent {
                        session_id: session_id.to_string(),
                        worktree_id: worktree_id.to_string(),
                        content,
                    },
                );
            }
            if response.tool_calls.len() > before_tool_count {
                for tool in &response.tool_calls[before_tool_count..] {
                    let _ = app.emit_all(
                        "chat:tool_use",
                        &ToolUseEvent {
                            session_id: session_id.to_string(),
                            worktree_id: worktree_id.to_string(),
                            id: tool.id.clone(),
                            name: tool.name.clone(),
                            input: tool.input.clone(),
                            parent_tool_use_id: tool.parent_tool_use_id.clone(),
                        },
                    );
                    let _ = app.emit_all(
                        "chat:tool_block",
                        &ToolBlockEvent {
                            session_id: session_id.to_string(),
                            worktree_id: worktree_id.to_string(),
                            tool_call_id: tool.id.clone(),
                        },
                    );
                }
            }
            if matches!(
                value.get("type").and_then(Value::as_str),
                Some("tool_execution_end" | "tool_result")
            ) {
                if let Some(tool_id) = value
                    .get("id")
                    .or_else(|| value.get("tool_use_id"))
                    .and_then(Value::as_str)
                {
                    if let Some(tool) = response.tool_calls.iter().find(|tool| tool.id == tool_id) {
                        if let Some(output) = &tool.output {
                            let _ = app.emit_all(
                                "chat:tool_result",
                                &ToolResultEvent {
                                    session_id: session_id.to_string(),
                                    worktree_id: worktree_id.to_string(),
                                    tool_use_id: tool_id.to_string(),
                                    output: output.clone(),
                                },
                            );
                        }
                    }
                }
            }
            if let Some(thinking) = value
                .get("delta")
                .and_then(|d| {
                    if d.get("type").and_then(Value::as_str) == Some("thinking_delta") {
                        d.get("text").and_then(Value::as_str)
                    } else {
                        None
                    }
                })
                .or_else(|| value.get("thinking").and_then(Value::as_str))
            {
                let _ = app.emit_all(
                    "chat:thinking",
                    &ThinkingEvent {
                        session_id: session_id.to_string(),
                        worktree_id: worktree_id.to_string(),
                        content: thinking.to_string(),
                    },
                );
            }
        }
    }

    Ok(response)
}

#[allow(clippy::too_many_arguments)]
pub fn execute_pi(
    app: &AppHandle,
    session_id: &str,
    worktree_id: &str,
    working_dir: &Path,
    existing_pi_session_id: Option<&str>,
    model: Option<&str>,
    execution_mode: Option<&str>,
    effort_level: Option<&super::types::EffortLevel>,
    message: &str,
    system_prompt: Option<&str>,
    pid_callback: Option<Box<dyn FnOnce(u32) + Send>>,
) -> Result<PiResponse, String> {
    let cli_path = crate::pi_cli::resolve_cli_binary(app);
    if !cli_path.exists() {
        return Err("PI CLI not installed".to_string());
    }

    let mut args = vec!["--mode".to_string(), "json".to_string()];
    if let Some(id) = existing_pi_session_id.filter(|id| !id.is_empty()) {
        args.push("--session".to_string());
        args.push(id.to_string());
    }
    if let Some(model) = raw_pi_model(model) {
        args.push("--model".to_string());
        args.push(model.to_string());
    }
    let pi_thinking = pi_thinking_level(effort_level);
    if let Some(thinking) = pi_thinking {
        args.push("--thinking".to_string());
        args.push(thinking.to_string());
    }
    args.push("--tools".to_string());
    args.push(pi_tools_for_mode(execution_mode.unwrap_or("plan")).to_string());
    append_system_prompt_arg(&mut args, system_prompt);
    args.push(message.to_string());

    log::info!(
        "[PI] spawning session={session_id} worktree={worktree_id} model={:?} mode={:?} thinking={:?} tools={}",
        raw_pi_model(model),
        execution_mode,
        pi_thinking,
        pi_tools_for_mode(execution_mode.unwrap_or("plan"))
    );

    let mut child = silent_command(&cli_path)
        .args(args)
        .current_dir(working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("JEAN_SESSION_ID", session_id)
        .env("JEAN_WORKTREE_ID", worktree_id)
        .spawn()
        .map_err(|e| format!("Failed to spawn PI CLI: {e}"))?;
    let pid = child.id();
    if let Some(callback) = pid_callback {
        callback(pid);
    }
    if !super::registry::register_process(session_id.to_string(), pid) {
        return Ok(PiResponse {
            content: String::new(),
            session_id: existing_pi_session_id.unwrap_or_default().to_string(),
            tool_calls: vec![],
            content_blocks: vec![],
            cancelled: true,
            usage: None,
        });
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture PI stdout".to_string())?;
    let stderr_handle = child.stderr.take().map(|mut stderr| {
        std::thread::spawn(move || {
            let mut buf = String::new();
            let _ = stderr.read_to_string(&mut buf);
            buf
        })
    });

    let mut response = parse_pi_stream(Some(app), session_id, worktree_id, BufReader::new(stdout))?;
    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for PI CLI: {e}"))?;
    let cancelled = !super::registry::is_process_running(session_id);
    super::registry::unregister_process(session_id);
    response.cancelled = cancelled;

    if response.session_id.is_empty() {
        response.session_id = existing_pi_session_id.unwrap_or_default().to_string();
    }

    if !status.success() && !cancelled {
        let stderr = stderr_handle
            .and_then(|h| h.join().ok())
            .unwrap_or_default();
        let error = if stderr.trim().is_empty() {
            "PI CLI exited with a non-zero status".to_string()
        } else {
            stderr.trim().to_string()
        };
        let _ = app.emit_all(
            "chat:error",
            &ErrorEvent {
                session_id: session_id.to_string(),
                worktree_id: worktree_id.to_string(),
                error: error.clone(),
            },
        );
        return Err(error);
    }

    if !cancelled {
        let _ = app.emit_all(
            "chat:done",
            &DoneEvent {
                session_id: session_id.to_string(),
                worktree_id: worktree_id.to_string(),
                waiting_for_plan: response
                    .tool_calls
                    .iter()
                    .any(|tool| tool.name == "ExitPlanMode"),
            },
        );
    }

    Ok(response)
}

pub fn execute_one_shot_pi(
    app: &AppHandle,
    prompt: &str,
    model: &str,
    working_dir: Option<&Path>,
    effort_level: Option<&str>,
) -> Result<String, String> {
    let cli_path = crate::pi_cli::resolve_cli_binary(app);
    if !cli_path.exists() {
        return Err("PI CLI not installed".to_string());
    }
    let dir = working_dir.unwrap_or_else(|| Path::new("."));
    let mut cmd = silent_command(&cli_path);
    cmd.args(["--mode", "json", "--no-session"]);
    cmd.args(["--model", raw_pi_model(Some(model)).unwrap_or(model)]);
    if let Some(effort) = effort_level {
        cmd.args(["--thinking", effort]);
    }
    cmd.arg(prompt)
        .current_dir(dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run PI one-shot request: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "PI one-shot request failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let response = parse_pi_stream(None, "", "", BufReader::new(output.stdout.as_slice()))?;
    if response.content.trim().is_empty() {
        return Err("No text content found in PI response".to_string());
    }
    Ok(response.content.trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_pi_json_mode_message_update_deltas() {
        let stream = r#"
{"type":"session","version":3,"id":"pi-json-mode-session","timestamp":"2026-06-08T08:43:06.173Z","cwd":"/tmp/project"}
{"type":"message_start","message":{"role":"assistant","content":[],"usage":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0}}}
{"type":"message_update","assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"Hello","partial":{"role":"assistant","content":[{"type":"text","text":"Hello"}]}}}
{"type":"message_update","assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"!","partial":{"role":"assistant","content":[{"type":"text","text":"Hello!"}]}}}
{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"Hello!"}],"usage":{"input":2531,"output":11,"cacheRead":1,"cacheWrite":2}}}
{"type":"turn_end","message":{"role":"assistant","content":[{"type":"text","text":"Hello!"}],"usage":{"input":2531,"output":11,"cacheRead":1,"cacheWrite":2}},"toolResults":[]}
"#;

        let response = parse_pi_json_stream_inner(stream);

        assert_eq!(response.session_id, "pi-json-mode-session");
        assert_eq!(response.content, "Hello!");
        assert_eq!(response.content_blocks.len(), 2);
        assert!(matches!(
            &response.content_blocks[0],
            ContentBlock::Text { text } if text == "Hello"
        ));
        assert!(matches!(
            &response.content_blocks[1],
            ContentBlock::Text { text } if text == "!"
        ));
        let usage = response.usage.unwrap();
        assert_eq!(usage.input_tokens, 2531);
        assert_eq!(usage.output_tokens, 11);
        assert_eq!(usage.cache_read_input_tokens, 1);
        assert_eq!(usage.cache_creation_input_tokens, 2);
    }

    #[test]
    fn parses_native_pi_message_jsonl() {
        let stream = r#"
{"type":"session","version":3,"id":"019ea639-cda3-7de3-9a29-2b8ff0e154db","timestamp":"2026-06-08T07:54:26.595Z","cwd":"/tmp/project"}
{"type":"message","id":"user-1","message":{"role":"user","content":[{"type":"text","text":"hello"}],"timestamp":1780905266609}}
{"type":"message","id":"assistant-1","message":{"role":"assistant","content":[{"type":"text","text":"Hello! How can I help with the project?","textSignature":"sig"}],"usage":{"input":4135,"output":17,"cacheRead":3,"cacheWrite":5}}}
"#;

        let response = parse_pi_json_stream_inner(stream);

        assert_eq!(response.session_id, "019ea639-cda3-7de3-9a29-2b8ff0e154db");
        assert_eq!(response.content, "Hello! How can I help with the project?");
        assert_eq!(response.content_blocks.len(), 1);
        assert!(matches!(
            &response.content_blocks[0],
            ContentBlock::Text { text } if text == "Hello! How can I help with the project?"
        ));
        let usage = response.usage.unwrap();
        assert_eq!(usage.input_tokens, 4135);
        assert_eq!(usage.output_tokens, 17);
        assert_eq!(usage.cache_read_input_tokens, 3);
        assert_eq!(usage.cache_creation_input_tokens, 5);
    }

    #[test]
    fn parses_native_pi_tool_calls_thinking_and_results() {
        let stream = r#"
{"type":"session","version":3,"id":"pi-session-tools","timestamp":"2026-06-08T07:54:26.595Z","cwd":"/tmp/project"}
{"type":"message","id":"assistant-1","parentId":null,"message":{"role":"assistant","content":[{"type":"thinking","thinking":"Need inspect file."},{"type":"toolCall","id":"call_123","name":"read","arguments":{"path":"README.md"}}],"usage":{"input":10,"output":2,"cacheRead":0,"cacheWrite":0}}}
{"type":"message","id":"tool-1","parentId":"assistant-1","message":{"role":"toolResult","toolCallId":"call_123","toolName":"read","content":[{"type":"text","text":"file contents"}],"isError":false}}
{"type":"message","id":"assistant-2","parentId":"tool-1","message":{"role":"assistant","content":[{"type":"text","text":"Done."}],"usage":{"input":11,"output":3,"cacheRead":1,"cacheWrite":2}}}
"#;

        let response = parse_pi_json_stream_inner(stream);

        assert_eq!(response.content, "Done.");
        assert_eq!(response.tool_calls.len(), 1);
        assert_eq!(response.tool_calls[0].id, "call_123");
        assert_eq!(response.tool_calls[0].name, "Read");
        assert_eq!(
            response.tool_calls[0].input,
            serde_json::json!({"path":"README.md"})
        );
        assert_eq!(
            response.tool_calls[0].output.as_deref(),
            Some("file contents")
        );
        assert!(matches!(
            &response.content_blocks[0],
            ContentBlock::Thinking { thinking } if thinking == "Need inspect file."
        ));
        assert!(matches!(
            &response.content_blocks[1],
            ContentBlock::ToolUse { tool_call_id } if tool_call_id == "call_123"
        ));
        assert!(matches!(
            &response.content_blocks[2],
            ContentBlock::Text { text } if text == "Done."
        ));
        let usage = response.usage.unwrap();
        assert_eq!(usage.input_tokens, 11);
        assert_eq!(usage.output_tokens, 3);
        assert_eq!(usage.cache_read_input_tokens, 1);
        assert_eq!(usage.cache_creation_input_tokens, 2);
    }

    #[test]
    fn parses_pi_text_tool_and_usage_events() {
        let stream = r#"
{"type":"session","session_id":"pi-session-1"}
{"type":"message_update","role":"assistant","delta":{"type":"text_delta","text":"hello "}}
{"type":"tool_execution_start","id":"tool-1","name":"read","input":{"path":"README.md"}}
{"type":"tool_execution_end","id":"tool-1","output":"ok"}
{"type":"message_update","role":"assistant","delta":{"type":"text_delta","text":"world"}}
{"type":"agent_end","usage":{"input_tokens":10,"output_tokens":20}}
"#;

        let response = parse_pi_json_stream_inner(stream);

        assert_eq!(response.session_id, "pi-session-1");
        assert_eq!(response.content, "hello world");
        assert_eq!(response.tool_calls.len(), 1);
        assert_eq!(response.tool_calls[0].id, "tool-1");
        assert_eq!(response.tool_calls[0].name, "Read");
        assert_eq!(response.tool_calls[0].output.as_deref(), Some("ok"));
        assert_eq!(response.content_blocks.len(), 3);
        assert!(matches!(
            &response.content_blocks[0],
            ContentBlock::Text { text } if text == "hello "
        ));
        assert!(matches!(
            &response.content_blocks[1],
            ContentBlock::ToolUse { tool_call_id } if tool_call_id == "tool-1"
        ));
        assert!(matches!(
            &response.content_blocks[2],
            ContentBlock::Text { text } if text == "world"
        ));
        assert_eq!(response.usage.as_ref().unwrap().input_tokens, 10);
        assert_eq!(response.usage.as_ref().unwrap().output_tokens, 20);
    }

    #[test]
    fn maps_effort_levels_to_pi_thinking_levels() {
        use super::super::types::EffortLevel;

        assert_eq!(pi_thinking_level(Some(&EffortLevel::Off)), Some("off"));
        assert_eq!(
            pi_thinking_level(Some(&EffortLevel::Minimal)),
            Some("minimal")
        );
        assert_eq!(pi_thinking_level(Some(&EffortLevel::Low)), Some("low"));
        assert_eq!(
            pi_thinking_level(Some(&EffortLevel::Medium)),
            Some("medium")
        );
        assert_eq!(pi_thinking_level(Some(&EffortLevel::High)), Some("high"));
        assert_eq!(pi_thinking_level(Some(&EffortLevel::Xhigh)), Some("xhigh"));
        assert_eq!(pi_thinking_level(None), None);
    }
}
