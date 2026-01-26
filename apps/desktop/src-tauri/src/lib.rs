// Moneywright Desktop - Window app for running the Moneywright server

mod server;
mod updater;

use server::{create_server_manager, get_server_url, start_server, stop_server, kill_process_on_port, SERVER_PORT, ServerStatus, SharedServerManager};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri::menu::{Menu, MenuItem, Submenu, PredefinedMenuItem};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::Mutex;

const APP_VERSION: &str = "v0.1.0";
const MAX_LOG_LINES: usize = 1000;

#[derive(Clone, Serialize)]
struct LogPayload {
    message: String,
    log_type: String,
}

#[derive(Clone, Serialize)]
struct InitialState {
    version: String,
    url: String,
    status: String,
}

/// Log storage for backend logs
pub struct LogStore {
    logs: Vec<String>,
}

impl LogStore {
    fn new() -> Self {
        Self { logs: Vec::new() }
    }

    fn add(&mut self, message: String) {
        self.logs.push(message);
        // Keep only last MAX_LOG_LINES
        if self.logs.len() > MAX_LOG_LINES {
            self.logs.remove(0);
        }
    }

    fn get_all(&self) -> Vec<String> {
        self.logs.clone()
    }

    fn clear(&mut self) {
        self.logs.clear();
    }
}

pub type SharedLogStore = Arc<Mutex<LogStore>>;

/// Emit a log message to the frontend
fn emit_log(app: &AppHandle, message: &str, log_type: &str) {
    let _ = app.emit("server-log", LogPayload {
        message: message.to_string(),
        log_type: log_type.to_string(),
    });
}

/// Emit status update to the frontend
fn emit_status(app: &AppHandle, status: &str) {
    let _ = app.emit("server-status", status);
}

/// Get initial state for the UI
#[tauri::command]
async fn get_initial_state(manager: tauri::State<'_, SharedServerManager>) -> Result<InitialState, String> {
    let mgr = manager.lock().await;
    let status = match mgr.status() {
        ServerStatus::Starting => "starting",
        ServerStatus::Running => "running",
        ServerStatus::Stopped => "stopped",
        ServerStatus::Error(_) => "error",
    };

    Ok(InitialState {
        version: APP_VERSION.to_string(),
        url: get_server_url(),
        status: status.to_string(),
    })
}

/// Start the server
#[tauri::command]
async fn start_server_cmd(app: AppHandle, manager: tauri::State<'_, SharedServerManager>, log_store: tauri::State<'_, SharedLogStore>) -> Result<(), String> {
    emit_status(&app, "starting");
    emit_log(&app, "Initializing server...", "info");

    let manager = manager.inner().clone();
    let log_store = log_store.inner().clone();
    let app_clone = app.clone();

    match start_server(app.clone(), manager.clone(), log_store).await {
        Ok(_) => {
            emit_status(&app_clone, "running");
            emit_log(&app_clone, &format!("Server running at {}", get_server_url()), "success");
            Ok(())
        }
        Err(e) => {
            emit_status(&app_clone, "error");
            emit_log(&app_clone, &format!("Failed to start server: {}", e), "error");
            Err(e)
        }
    }
}

/// Stop the server
#[tauri::command]
async fn stop_server_cmd(app: AppHandle, manager: tauri::State<'_, SharedServerManager>) -> Result<(), String> {
    emit_log(&app, "Stopping server...", "info");

    let manager = manager.inner().clone();
    match stop_server(manager).await {
        Ok(_) => {
            emit_status(&app, "stopped");
            emit_log(&app, "Server stopped", "info");
            Ok(())
        }
        Err(e) => {
            emit_log(&app, &format!("Failed to stop server: {}", e), "error");
            Err(e)
        }
    }
}

/// Restart the server
#[tauri::command]
async fn restart_server_cmd(app: AppHandle, manager: tauri::State<'_, SharedServerManager>, log_store: tauri::State<'_, SharedLogStore>) -> Result<(), String> {
    emit_log(&app, "Restarting server...", "info");

    // Stop first
    let manager_inner = manager.inner().clone();
    let log_store = log_store.inner().clone();
    if let Err(e) = stop_server(manager_inner.clone()).await {
        emit_log(&app, &format!("Warning: Failed to stop server: {}", e), "error");
    }

    // Small delay
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    // Start again
    emit_status(&app, "starting");
    match start_server(app.clone(), manager_inner.clone(), log_store).await {
        Ok(_) => {
            emit_status(&app, "running");
            emit_log(&app, &format!("Server restarted at {}", get_server_url()), "success");
            Ok(())
        }
        Err(e) => {
            emit_status(&app, "error");
            emit_log(&app, &format!("Failed to restart server: {}", e), "error");
            Err(e)
        }
    }
}

/// Open browser to the server URL
#[tauri::command]
async fn open_browser_cmd(app: AppHandle) -> Result<(), String> {
    let url = get_server_url();
    emit_log(&app, &format!("Opening browser: {}", url), "info");
    open::that(&url).map_err(|e| format!("Failed to open browser: {}", e))
}

/// Get backend logs
#[tauri::command]
async fn get_logs(log_store: tauri::State<'_, SharedLogStore>) -> Result<Vec<String>, String> {
    let store = log_store.lock().await;
    Ok(store.get_all())
}

/// Clear backend logs
#[tauri::command]
async fn clear_logs(log_store: tauri::State<'_, SharedLogStore>) -> Result<(), String> {
    let mut store = log_store.lock().await;
    store.clear();
    Ok(())
}

/// Quit the application
#[tauri::command]
async fn quit_app_cmd(app: AppHandle) -> Result<(), String> {
    emit_log(&app, "Shutting down...", "info");

    // Kill server process synchronously
    let _ = kill_process_on_port(SERVER_PORT);

    // Exit the app
    app.exit(0);
    Ok(())
}

/// Open the logs window
fn open_logs_window(app: &AppHandle) {
    // Check if window already exists
    if let Some(window) = app.get_webview_window("logs") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    // Create logs window that loads from localhost with a special route
    // We'll inject the HTML after the window is created
    let window = WebviewWindowBuilder::new(
        app,
        "logs",
        WebviewUrl::App("/".into()),
    )
    .title("View Logs")
    .inner_size(1000.0, 500.0)
    .min_inner_size(400.0, 300.0)
    .build();

    if let Ok(win) = window {
        // Inject the logs UI HTML
        let log_html = r#"
            document.documentElement.innerHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>View Logs</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
            font-size: 12px;
            background: #1a1a1a;
            color: #e0e0e0;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .toolbar {
            padding: 8px 12px;
            background: #252525;
            border-bottom: 1px solid #333;
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .toolbar button {
            padding: 4px 12px;
            background: #333;
            border: 1px solid #444;
            color: #e0e0e0;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
        }
        .toolbar button:hover { background: #444; }
        .toolbar span { color: #888; font-size: 11px; }
        #logs {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .log-line { padding: 2px 0; }
        .log-line.error { color: #f87171; }
        .log-line.server { color: #a3e635; }
        .log-line.info { color: #60a5fa; }
    </style>
</head>
<body>
    <div class="toolbar">
        <button id="refreshBtn">Refresh</button>
        <button id="clearBtn">Clear</button>
        <span id="count"></span>
    </div>
    <div id="logs"></div>
</body>
</html>`;

            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            async function refreshLogs() {
                try {
                    const logs = await window.__TAURI__.core.invoke('get_logs');
                    const container = document.getElementById('logs');
                    // Check if user is near the bottom before updating
                    const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
                    container.innerHTML = logs.map(log => {
                        let cls = 'log-line';
                        if (log.includes('[error]') || log.includes('Error') || log.includes('error:')) cls += ' error';
                        else if (log.includes('[moneywright]')) cls += ' server';
                        else cls += ' info';
                        return '<div class="' + cls + '">' + escapeHtml(log) + '</div>';
                    }).join('');
                    document.getElementById('count').textContent = logs.length + ' lines';
                    // Only auto-scroll if user was already at/near the bottom
                    if (wasAtBottom) {
                        container.scrollTop = container.scrollHeight;
                    }
                } catch (e) {
                    document.getElementById('logs').innerHTML = '<div class="log-line error">Failed to load logs: ' + e + '</div>';
                }
            }

            async function clearLogs() {
                try {
                    await window.__TAURI__.core.invoke('clear_logs');
                    refreshLogs();
                } catch (e) {
                    console.error('Failed to clear logs:', e);
                }
            }

            document.getElementById('refreshBtn').onclick = refreshLogs;
            document.getElementById('clearBtn').onclick = clearLogs;

            refreshLogs();
            setInterval(refreshLogs, 2000);
        "#;

        // Wait a moment for the page to load, then inject our UI
        let win_clone = win.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            let _ = win_clone.eval(log_html);
        });
    }
}

/// Refresh the main window
fn refresh_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let url = get_server_url();
        let _ = window.eval(&format!("window.location.href = '{}'", url));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_initial_state,
            start_server_cmd,
            stop_server_cmd,
            restart_server_cmd,
            open_browser_cmd,
            get_logs,
            clear_logs,
            quit_app_cmd,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();

            // Create log store
            let log_store: SharedLogStore = Arc::new(Mutex::new(LogStore::new()));
            app.manage(log_store.clone());

            // Create server manager with app handle (for data directory)
            let server_manager = create_server_manager(&handle);
            app.manage(server_manager.clone());

            // Setup menu
            setup_menu(&handle)?;

            // Start server synchronously before window loads
            let manager = server_manager.clone();
            let app_handle = handle.clone();

            tauri::async_runtime::block_on(async move {
                match start_server(app_handle.clone(), manager, log_store).await {
                    Ok(_) => {
                        println!("Server started successfully at {}", get_server_url());
                    }
                    Err(e) => {
                        eprintln!("Failed to start server: {}", e);
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    #[cfg(target_os = "macos")]
                    {
                        // macOS: Hide window, app stays in dock, server keeps running
                        // User can reopen from dock, quit via Cmd+Q or menu
                        let _ = window.hide();
                        api.prevent_close();
                    }
                    #[cfg(not(target_os = "macos"))]
                    {
                        // Windows/Linux: Quit app and kill server
                        let _ = kill_process_on_port(SERVER_PORT);
                        window.app_handle().exit(0);
                    }
                }
            }
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "refresh" => refresh_main_window(app),
                "open_browser" => {
                    let _ = open::that(get_server_url());
                }
                "logs" => open_logs_window(app),
                "quit" => {
                    // Kill server process synchronously before exit
                    let _ = kill_process_on_port(SERVER_PORT);
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            match event {
                #[cfg(target_os = "macos")]
                tauri::RunEvent::Reopen { .. } => {
                    // Show main window when dock icon is clicked (macOS)
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                    // Kill server process synchronously - this is critical for cleanup
                    // We use the direct kill approach because async may not complete before termination
                    let _ = kill_process_on_port(SERVER_PORT);
                }
                _ => {}
            }
        });
}

fn setup_menu(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // App submenu (macOS)
    let about = MenuItem::with_id(app, "about", "About Moneywright", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Moneywright", true, Some("CmdOrCtrl+Q"))?;

    let app_menu = Submenu::with_items(
        app,
        "Moneywright",
        true,
        &[
            &about,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    // View submenu
    let refresh = MenuItem::with_id(app, "refresh", "Refresh", true, Some("CmdOrCtrl+R"))?;
    let open_browser = MenuItem::with_id(app, "open_browser", "Open in Browser", true, Some("CmdOrCtrl+Shift+O"))?;
    let logs = MenuItem::with_id(app, "logs", "View Logs", true, Some("CmdOrCtrl+L"))?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &refresh,
            &open_browser,
            &PredefinedMenuItem::separator(app)?,
            &logs,
        ],
    )?;

    // Edit submenu (for copy/paste)
    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    // Window submenu
    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    let menu = Menu::with_items(
        app,
        &[&app_menu, &edit_menu, &view_menu, &window_menu],
    )?;

    app.set_menu(menu)?;
    Ok(())
}
