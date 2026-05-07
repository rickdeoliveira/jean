use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Mutex;

/// Tracks every browser tab created by `browser_create`.
/// Maps tab_id → webview label (used for `app.get_webview(label)` lookups).
pub static BROWSER_TABS: Lazy<Mutex<HashMap<String, String>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub fn register_tab(tab_id: String, label: String) {
    let mut tabs = BROWSER_TABS.lock().unwrap();
    tabs.insert(tab_id, label);
}

pub fn unregister_tab(tab_id: &str) -> Option<String> {
    let mut tabs = BROWSER_TABS.lock().unwrap();
    tabs.remove(tab_id)
}

pub fn get_label(tab_id: &str) -> Option<String> {
    let tabs = BROWSER_TABS.lock().unwrap();
    tabs.get(tab_id).cloned()
}

pub fn has_tab(tab_id: &str) -> bool {
    let tabs = BROWSER_TABS.lock().unwrap();
    tabs.contains_key(tab_id)
}

pub fn get_all_tab_ids() -> Vec<String> {
    let tabs = BROWSER_TABS.lock().unwrap();
    tabs.keys().cloned().collect()
}

/// Compute webview label for a tab. Stable across restarts when tab_id is persisted.
pub fn label_for_tab(tab_id: &str) -> String {
    format!("browser-{tab_id}")
}
