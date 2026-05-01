use std::collections::HashSet;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use rdev::{listen, EventType, Key};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Clone, Serialize, Deserialize)]
struct KeyInputPayload {
    key_name: String,
    event_type: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct KeysSyncPayload {
    active_keys: Vec<String>,
}

#[derive(Clone, Serialize)]
struct PopoutInteractionPayload {
    section: &'static str,
    interactive: bool,
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
enum PopoutSection {
    Keyboard,
    Chart,
    Score,
}

impl PopoutSection {
    fn as_str(self) -> &'static str {
        match self {
            Self::Keyboard => "keyboard",
            Self::Chart => "chart",
            Self::Score => "score",
        }
    }

    fn title(self) -> &'static str {
        match self {
            Self::Keyboard => "Keyboard",
            Self::Chart => "Chart",
            Self::Score => "Score",
        }
    }

    fn default_size(self) -> (f64, f64) {
        match self {
            Self::Keyboard => (920.0, 300.0),
            Self::Chart => (760.0, 220.0),
            Self::Score => (720.0, 280.0),
        }
    }

    fn window_label(self) -> String {
        format!("popout_{}", self.as_str())
    }
}

lazy_static::lazy_static! {
    static ref ACTIVE_KEYS: Arc<Mutex<HashSet<String>>> = Arc::new(Mutex::new(HashSet::new()));
}

static INPUT_CAPTURE_CLIENTS: AtomicUsize = AtomicUsize::new(0);

fn map_key_to_string(key: Key) -> String {
    format!("{:?}", key)
}

#[tauri::command]
async fn popout_open(app: AppHandle, section: PopoutSection) -> Result<(), String> {
    let label = section.window_label();

    // Show an existing OBS window without stealing focus from the game.
    if let Some(win) = app.get_webview_window(&label) {
        win.show().map_err(|e| e.to_string())?;
        win.set_always_on_top(true).map_err(|e| e.to_string())?;
        win.center().map_err(|e| e.to_string())?;
        win.set_ignore_cursor_events(false).map_err(|e| e.to_string())?;
        let _ = app.emit(
            "popout-interaction-changed",
            PopoutInteractionPayload {
                section: section.as_str(),
                interactive: true,
            },
        );
        return Ok(());
    }

    let (width, height) = section.default_size();
    let main_win = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;
    let base_url = main_win.url().map_err(|e| e.to_string())?;
    let url = format!(
        "{}#/popout/{}",
        base_url.as_str().trim_end_matches('/'),
        section.as_str()
    );
    let parsed_url = url.parse().map_err(|_| format!("Invalid URL: {}", url))?;

    let win = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(parsed_url))
        .title(format!("KeyFlow - {}", section.title()))
        .inner_size(width, height)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .shadow(false)
        .focused(false)
        .skip_taskbar(true)
        .build()
        .map_err(|e| e.to_string())?;

    win.center().map_err(|e| e.to_string())?;
    win.set_ignore_cursor_events(false).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "popout-interaction-changed",
        PopoutInteractionPayload {
            section: section.as_str(),
            interactive: true,
        },
    );

    Ok(())
}

#[tauri::command]
async fn popout_set_click_through(
    app: AppHandle,
    section: PopoutSection,
    click_through: bool,
) -> Result<(), String> {
    let label = section.window_label();
    if let Some(win) = app.get_webview_window(&label) {
        win.set_ignore_cursor_events(click_through)
            .map_err(|e| e.to_string())?;
        let _ = app.emit(
            "popout-interaction-changed",
            PopoutInteractionPayload {
                section: section.as_str(),
                interactive: !click_through,
            },
        );
    }
    Ok(())
}

#[tauri::command]
async fn popout_close(app: AppHandle, section: PopoutSection) -> Result<(), String> {
    let label = section.window_label();
    if let Some(win) = app.get_webview_window(&label) {
        let _ = app.emit("popout-closed", section.as_str());
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn popout_hide(app: AppHandle, section: PopoutSection) -> Result<(), String> {
    let label = section.window_label();
    if let Some(win) = app.get_webview_window(&label) {
        win.set_always_on_top(false).map_err(|e| e.to_string())?;
        win.set_ignore_cursor_events(true).map_err(|e| e.to_string())?;
        let _ = app.emit(
            "popout-interaction-changed",
            PopoutInteractionPayload {
                section: section.as_str(),
                interactive: false,
            },
        );
        win.set_position(tauri::PhysicalPosition::new(-32000, -32000))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn popout_show(app: AppHandle, section: PopoutSection) -> Result<(), String> {
    let label = section.window_label();
    if let Some(win) = app.get_webview_window(&label) {
        win.set_always_on_top(true).map_err(|e| e.to_string())?;
        win.center().map_err(|e| e.to_string())?;
        win.set_ignore_cursor_events(false).map_err(|e| e.to_string())?;
        let _ = app.emit(
            "popout-interaction-changed",
            PopoutInteractionPayload {
                section: section.as_str(),
                interactive: true,
            },
        );
    }
    Ok(())
}

#[tauri::command]
async fn input_capture_acquire() -> Result<usize, String> {
    Ok(INPUT_CAPTURE_CLIENTS.fetch_add(1, Ordering::SeqCst) + 1)
}

#[tauri::command]
async fn input_capture_release() -> Result<usize, String> {
    let mut current = INPUT_CAPTURE_CLIENTS.load(Ordering::SeqCst);

    loop {
        if current == 0 {
            return Ok(0);
        }

        match INPUT_CAPTURE_CLIENTS.compare_exchange(
            current,
            current - 1,
            Ordering::SeqCst,
            Ordering::SeqCst,
        ) {
            Ok(_) => {
                let remaining = current - 1;
                if remaining == 0 {
                    if let Ok(mut keys) = ACTIVE_KEYS.lock() {
                        keys.clear();
                    }
                }
                return Ok(remaining);
            }
            Err(actual) => current = actual,
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            popout_open,
            popout_set_click_through,
            popout_close,
            popout_hide,
            popout_show,
            input_capture_acquire,
            input_capture_release
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            thread::spawn(move || {
                if let Err(error) = listen(move |event| {
                    if INPUT_CAPTURE_CLIENTS.load(Ordering::SeqCst) == 0 {
                        return;
                    }

                    let (key_name, event_type) = match event.event_type {
                        EventType::KeyPress(key) => {
                            let k = map_key_to_string(key);
                            if let Ok(mut keys) = ACTIVE_KEYS.lock() {
                                keys.insert(k.clone());
                            }
                            (k, "keydown".to_string())
                        }
                        EventType::KeyRelease(key) => {
                            let k = map_key_to_string(key);
                            if let Ok(mut keys) = ACTIVE_KEYS.lock() {
                                keys.remove(&k);
                            }
                            (k, "keyup".to_string())
                        }
                        EventType::ButtonPress(btn) => {
                            let k = format!("Mouse{:?}", btn);
                            if let Ok(mut keys) = ACTIVE_KEYS.lock() {
                                keys.insert(k.clone());
                            }
                            (k, "mousedown".to_string())
                        }
                        EventType::ButtonRelease(btn) => {
                            let k = format!("Mouse{:?}", btn);
                            if let Ok(mut keys) = ACTIVE_KEYS.lock() {
                                keys.remove(&k);
                            }
                            (k, "mouseup".to_string())
                        }
                        _ => return,
                    };

                    let _ = handle.emit(
                        "global-input",
                        KeyInputPayload {
                            key_name,
                            event_type,
                        },
                    );
                }) {
                    log::error!("global input listener failed: {:?}", error);
                }
            });

            let handle_sync = app.handle().clone();
            thread::spawn(move || loop {
                thread::sleep(Duration::from_millis(100));
                let keys = if INPUT_CAPTURE_CLIENTS.load(Ordering::SeqCst) == 0 {
                    Vec::new()
                } else if let Ok(keys) = ACTIVE_KEYS.lock() {
                    keys.iter().cloned().collect::<Vec<String>>()
                } else {
                    Vec::new()
                };

                let _ = handle_sync.emit("keys-sync", KeysSyncPayload { active_keys: keys });
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
