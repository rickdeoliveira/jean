pub mod auth;
pub mod dispatch;
pub mod server;
pub mod websocket;

use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::broadcast;

/// Global monotonic sequence counter for event replay.
static EVENT_SEQ: AtomicU64 = AtomicU64::new(1);

/// Maximum events buffered per session for replay.
const SESSION_BUFFER_CAP: usize = 2000;

/// Events that are worth buffering for replay on reconnect.
const REPLAYABLE_EVENTS: &[&str] = &[
    "chat:sending",
    "chat:chunk",
    "chat:tool_use",
    "chat:tool_block",
    "chat:tool_result",
    "chat:thinking",
    "chat:permission_denied",
    "chat:codex_command_approval_request",
    "chat:codex_permission_request",
    "chat:codex_user_input_request",
    "chat:codex_mcp_elicitation_request",
    "chat:codex_dynamic_tool_call_request",
    "chat:done",
    "chat:cancelled",
    "chat:error",
];

/// Broadcast channel for sending events to all connected WebSocket clients.
/// Managed as Tauri state so any code with an AppHandle can broadcast.
pub struct WsBroadcaster {
    tx: broadcast::Sender<WsEvent>,
    /// Per-session ring buffer for event replay on WebSocket reconnect.
    /// Key: session_id extracted from the event payload.
    session_buffers: Mutex<HashMap<String, VecDeque<(u64, Arc<str>)>>>,
}

/// A pre-serialized WebSocket event.
/// The JSON string is wrapped in `Arc<str>` so cloning across N broadcast
/// receivers is a cheap reference-count increment instead of N allocations.
#[derive(Clone, Debug)]
pub struct WsEvent {
    pub json: Arc<str>,
    /// Monotonic sequence number for replay ordering.
    pub seq: u64,
}

/// Wire-format envelope serialized once in `broadcast()`.
#[derive(Serialize)]
struct WsEnvelope<'a, S: Serialize> {
    #[serde(rename = "type")]
    msg_type: &'static str,
    event: &'a str,
    payload: &'a S,
    /// Monotonic sequence number for replay ordering.
    seq: u64,
}

impl WsBroadcaster {
    pub fn new() -> (Self, broadcast::Sender<WsEvent>) {
        // Buffer 8192 events — generous headroom for burst streaming with
        // multiple clients. Each WsEvent is ~16 bytes (Arc pointer + len).
        let (tx, _) = broadcast::channel(8192);
        let tx_clone = tx.clone();
        (
            Self {
                tx,
                session_buffers: Mutex::new(HashMap::new()),
            },
            tx_clone,
        )
    }

    /// Serialize the payload once into the wire-format JSON envelope.
    /// Each broadcast receiver gets an `Arc<str>` clone (cheap ref-count
    /// increment) instead of re-serializing per client.
    pub fn broadcast<S: Serialize>(&self, event: &str, payload: &S) {
        let seq = EVENT_SEQ.fetch_add(1, Ordering::Relaxed);
        let envelope = WsEnvelope {
            msg_type: "event",
            event,
            payload,
            seq,
        };
        let json = match serde_json::to_string(&envelope) {
            Ok(s) => s,
            Err(e) => {
                log::error!("Failed to serialize WS event '{event}': {e}");
                return;
            }
        };
        let json_arc: Arc<str> = Arc::from(json);

        // Buffer replayable events per session
        if REPLAYABLE_EVENTS.contains(&event) {
            // Try to extract session_id from the payload
            if let Ok(val) = serde_json::to_value(payload) {
                if let Some(sid) = val.get("session_id").and_then(|v| v.as_str()) {
                    if let Ok(mut buffers) = self.session_buffers.lock() {
                        let buf = buffers
                            .entry(sid.to_string())
                            .or_insert_with(|| VecDeque::with_capacity(SESSION_BUFFER_CAP));
                        if buf.len() >= SESSION_BUFFER_CAP {
                            buf.pop_front();
                        }
                        buf.push_back((seq, json_arc.clone()));
                    }
                }
            }
        }

        // Clean up session buffer on chat:done or chat:cancelled
        if event == "chat:done" || event == "chat:cancelled" {
            if let Ok(val) = serde_json::to_value(payload) {
                if let Some(sid) = val.get("session_id").and_then(|v| v.as_str()) {
                    if let Ok(mut buffers) = self.session_buffers.lock() {
                        buffers.remove(sid);
                    }
                }
            }
        }

        // Ignore send errors (no active receivers is fine)
        let _ = self.tx.send(WsEvent {
            json: json_arc,
            seq,
        });
    }

    pub fn subscribe(&self) -> broadcast::Receiver<WsEvent> {
        self.tx.subscribe()
    }

    /// Replay buffered events for a session after the given sequence number.
    /// Returns events in order, each with its sequence number and pre-serialized JSON.
    pub fn replay_events(&self, session_id: &str, after_seq: u64) -> Vec<(u64, Arc<str>)> {
        let buffers = match self.session_buffers.lock() {
            Ok(b) => b,
            Err(_) => return Vec::new(),
        };
        match buffers.get(session_id) {
            Some(buf) => buf
                .iter()
                .filter(|(seq, _)| *seq > after_seq)
                .cloned()
                .collect(),
            None => Vec::new(),
        }
    }
}

/// Extension trait on AppHandle that sends to both Tauri IPC and WebSocket clients.
/// Use `app.emit_all("event", &payload)` instead of `app.emit("event", &payload)`.
pub trait EmitExt {
    fn emit_all<S: Serialize + Clone>(&self, event: &str, payload: &S) -> Result<(), String>;
    /// Like `emit_all` but takes ownership of the payload, avoiding a caller-side clone
    /// on the hot path (e.g. high-frequency terminal output chunks).
    fn emit_all_owned<S: Serialize + Clone>(&self, event: &str, payload: S) -> Result<(), String>;
}

impl EmitExt for AppHandle {
    fn emit_all<S: Serialize + Clone>(&self, event: &str, payload: &S) -> Result<(), String> {
        // Send to Tauri frontend (native app)
        self.emit(event, payload.clone())
            .map_err(|e| format!("Tauri emit failed: {e}"))?;

        // Broadcast to WebSocket clients (if server is running).
        // Serializes directly from &S → JSON in one pass (no intermediate Value).
        if let Some(ws) = self.try_state::<WsBroadcaster>() {
            ws.broadcast(event, payload);
        }

        Ok(())
    }

    fn emit_all_owned<S: Serialize + Clone>(&self, event: &str, payload: S) -> Result<(), String> {
        // Broadcast to WebSocket clients first (borrows payload, no clone needed here).
        if let Some(ws) = self.try_state::<WsBroadcaster>() {
            ws.broadcast(event, &payload);
        }

        // Send to Tauri frontend — consumes payload (Tauri's emit requires Clone internally).
        self.emit(event, payload)
            .map_err(|e| format!("Tauri emit failed: {e}"))?;

        Ok(())
    }
}
