use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager, WebviewWindowBuilder, WebviewUrl, Emitter};
use serde::{Serialize, Deserialize};
use rdev::{listen, EventType, Key};

#[derive(Clone, Serialize, Deserialize)]
struct KeyInputPayload {
    key_name: String,
    event_type: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct KeysSyncPayload {
    active_keys: Vec<String>,
}

// Global state to track currently pressed keys
lazy_static::lazy_static! {
    static ref ACTIVE_KEYS: Arc<Mutex<HashSet<String>>> = Arc::new(Mutex::new(HashSet::new()));
}

fn map_key_to_string(key: Key) -> String {
    format!("{:?}", key)
}

#[tauri::command]
async fn popout_open(app: AppHandle, section: String) -> Result<(), String> {
    let label = format!("popout_{}", section);
    
    // If window exists, focus it
    if let Some(win) = app.get_webview_window(&label) {
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Default sizes for sections
    let (width, height) = match section.as_str() {
        "keyboard" => (1200.0, 380.0),
        "chart" => (900.0, 320.0),
        "score" => (800.0, 400.0),
        _ => (800.0, 400.0),
    };

    // Get the base URL from the main window to support both dev and production
    let main_win = app.get_webview_window("main").ok_or("Main window not found")?;
    let base_url = main_win.url().map_err(|e| e.to_string())?;
    let url = format!("{}#/popout/{}", base_url.as_str().trim_end_matches('/'), section);

    let win = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(url.parse().unwrap()))
        .title(format!("KeyFlow — {}", section))
        .inner_size(width, height)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .shadow(false)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn popout_close(app: AppHandle, section: String) -> Result<(), String> {
    let label = format!("popout_{}", section);
    if let Some(win) = app.get_webview_window(&label) {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn popout_hide(app: AppHandle, section: String) -> Result<(), String> {
    let label = format!("popout_{}", section);
    if let Some(win) = app.get_webview_window(&label) {
        // Move far off-screen so OBS still captures but user can't see it
        win.set_always_on_top(false).map_err(|e| e.to_string())?;
        win.set_position(tauri::PhysicalPosition::new(-32000, -32000)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn popout_show(app: AppHandle, section: String) -> Result<(), String> {
    let label = format!("popout_{}", section);
    if let Some(win) = app.get_webview_window(&label) {
        win.set_always_on_top(true).map_err(|e| e.to_string())?;
        win.center().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}



pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            popout_open, 
            popout_close, 
            popout_hide, 
            popout_show
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            
            // 1. Global Input Listener Thread
            thread::spawn(move || {
                if let Err(error) = listen(move |event| {
                    let (key_name, event_type) = match event.event_type {
                        EventType::KeyPress(key) => {
                            let k = map_key_to_string(key);
                            if let Ok(mut keys) = ACTIVE_KEYS.lock() {
                                keys.insert(k.clone());
                            }
                            (k, "keydown".to_string())
                        },
                        EventType::KeyRelease(key) => {
                            let k = map_key_to_string(key);
                            if let Ok(mut keys) = ACTIVE_KEYS.lock() {
                                keys.remove(&k);
                            }
                            (k, "keyup".to_string())
                        },
                        EventType::ButtonPress(btn) => {
                            let k = format!("Mouse{:?}", btn);
                            if let Ok(mut keys) = ACTIVE_KEYS.lock() {
                                keys.insert(k.clone());
                            }
                            (k, "mousedown".to_string())
                        },
                        EventType::ButtonRelease(btn) => {
                            let k = format!("Mouse{:?}", btn);
                            if let Ok(mut keys) = ACTIVE_KEYS.lock() {
                                keys.remove(&k);
                            }
                            (k, "mouseup".to_string())
                        },
                        _ => return,
                    };

                    let _ = handle.emit("global-input", KeyInputPayload {
                        key_name,
                        event_type,
                    });
                }) {
                    println!("Error: {:?}", error);
                }
            });

            // 2. Periodic Keys Sync Thread (Every 500ms)
            let handle_sync = app.handle().clone();
            thread::spawn(move || {
                loop {
                    thread::sleep(Duration::from_millis(100));
                    let keys = if let Ok(keys) = ACTIVE_KEYS.lock() {
                        keys.iter().cloned().collect::<Vec<String>>()
                    } else {
                        Vec::new()
                    };

                    let _ = handle_sync.emit("keys-sync", KeysSyncPayload {
                        active_keys: keys,
                    });
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
