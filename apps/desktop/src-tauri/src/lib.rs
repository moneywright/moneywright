// Moneywright Desktop - Window app for running the Moneywright server

mod server;
mod updater;

use server::{create_server_manager, get_server_url, start_server, stop_server, kill_process_on_port, SERVER_PORT, ServerStatus, SharedServerManager};
use updater::{check_for_updates, download_and_install};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri::menu::{Menu, MenuItem, Submenu, PredefinedMenuItem};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::Mutex;

// Version is read from Cargo.toml at compile time
const APP_VERSION: &str = concat!("v", env!("CARGO_PKG_VERSION"));
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

/// Open any URL in the default browser
#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
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

    // Kill server process synchronously (only in release mode)
    #[cfg(not(debug_assertions))]
    let _ = kill_process_on_port(SERVER_PORT);

    // Exit the app
    app.exit(0);
    Ok(())
}

/// Download and install update
#[tauri::command]
async fn download_update(app: AppHandle) -> Result<(), String> {
    download_and_install(app).await
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
    .visible(false) // Start hidden to avoid flash
    .build();

    if let Ok(win) = window {
        // Inject the logs UI HTML - styled to match web app's dark mode design tokens
        // This uses static/hardcoded HTML content (no user input), same pattern as about window
        let log_html = r#"
            document.documentElement.innerHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>View Logs</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 13px;
            background: #030303;
            color: #fafafa;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.15); }

        .toolbar {
            padding: 12px 16px;
            background: #0a0a0a;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            display: flex;
            gap: 10px;
            align-items: center;
            flex-shrink: 0;
        }

        .toolbar button {
            padding: 6px 14px;
            background: #111111;
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: #a1a1aa;
            border-radius: 6px;
            cursor: pointer;
            font-family: 'DM Sans', sans-serif;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .toolbar button:hover {
            background: #161616;
            border-color: rgba(255, 255, 255, 0.12);
            color: #fafafa;
        }

        .toolbar button:active {
            background: #1a1a1a;
        }

        .toolbar button svg {
            width: 14px;
            height: 14px;
            opacity: 0.7;
        }

        .toolbar button:hover svg {
            opacity: 1;
        }

        .toolbar .count {
            color: #52525b;
            font-size: 12px;
            margin-left: auto;
            font-variant-numeric: tabular-nums;
        }

        #logs {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            background: #030303;
        }

        .log-line {
            font-family: 'DM Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
            font-size: 12px;
            line-height: 1.6;
            padding: 3px 0;
            white-space: pre-wrap;
            word-break: break-all;
            color: #a1a1aa;
        }

        .log-line.error {
            color: #ef4444;
        }

        .log-line.warning {
            color: #f59e0b;
        }

        .log-line.success {
            color: #10b981;
        }

        .log-line.server {
            color: #fafafa;
        }

        .log-line .prefix {
            color: #52525b;
        }

        .log-line .highlight {
            color: #10b981;
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #52525b;
            gap: 8px;
        }

        .empty-state svg {
            width: 32px;
            height: 32px;
            opacity: 0.5;
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <button id="refreshBtn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 16h5v5"/>
            </svg>
            Refresh
        </button>
        <button id="clearBtn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
            Clear
        </button>
        <span class="count" id="count"></span>
    </div>
    <div id="logs"></div>
</body>
</html>`;

            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            function classifyLog(log) {
                const lower = log.toLowerCase();

                // Check for explicit log level markers first (highest priority)
                if (lower.includes('[error]') || lower.includes(':err]') || lower.includes('[err]')) {
                    return 'error';
                }
                if (lower.includes('[warn]') || lower.includes('[warning]')) {
                    return 'warning';
                }

                // Success patterns - check these before error patterns
                // Handle "X success, Y failed" pattern - if it has success count, it's a success summary
                if (/\d+\s*success/i.test(log) && lower.includes('complete')) {
                    return 'success';
                }
                if (lower.includes('server is running') || lower.includes('migrations completed') || lower.includes('started successfully') || lower.includes('succeeded')) {
                    return 'success';
                }

                // Error patterns - but exclude "0 failed" which indicates no failures
                const hasZeroFailed = /\b0\s+failed\b/i.test(log);
                const hasFailed = lower.includes('failed');
                if (hasFailed && !hasZeroFailed) {
                    return 'error';
                }
                if (/\berror:/i.test(log) || lower.includes('exception') || lower.includes('crash')) {
                    return 'error';
                }

                // Warning patterns
                if (/\bwarning:/i.test(log) || lower.includes('deprecated')) {
                    return 'warning';
                }

                // Server log lines (neutral, but slightly highlighted)
                if (log.includes('[moneywright]')) {
                    return 'server';
                }

                return '';
            }

            async function refreshLogs() {
                try {
                    const logs = await window.__TAURI__.core.invoke('get_logs');
                    const container = document.getElementById('logs');
                    const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;

                    if (logs.length === 0) {
                        container.innerHTML = '<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg><span>No logs yet</span></div>';
                        document.getElementById('count').textContent = '';
                        return;
                    }

                    container.innerHTML = logs.map(log => {
                        const cls = classifyLog(log);
                        return '<div class="log-line' + (cls ? ' ' + cls : '') + '">' + escapeHtml(log) + '</div>';
                    }).join('');

                    document.getElementById('count').textContent = logs.length + ' lines';

                    if (wasAtBottom) {
                        container.scrollTop = container.scrollHeight;
                    }
                } catch (e) {
                    document.getElementById('logs').innerHTML = '<div class="log-line error">Failed to load logs: ' + escapeHtml(String(e)) + '</div>';
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
            // Show window after content is injected
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            let _ = win_clone.show();
            let _ = win_clone.set_focus();
        });
    }
}

/// Refresh the main window
fn refresh_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let url = get_server_url();
        // Using Tauri's webview eval API to navigate - this is safe as we control the URL
        let _ = window.eval(&format!("window.location.href = '{}'", url));
    }
}

/// Clear cookies and browsing data from all windows
fn clear_cookies(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.clear_all_browsing_data();
        // Refresh the window after clearing - using Tauri's webview eval API with app-controlled URL
        let url = get_server_url();
        let _ = window.eval(&format!("window.location.href = '{}'", url));
    }
}

/// Open the about window
fn open_about_window(app: &AppHandle) {
    // Check if window already exists
    if let Some(window) = app.get_webview_window("about") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    let window = WebviewWindowBuilder::new(
        app,
        "about",
        WebviewUrl::App("/".into()),
    )
    .title("About Moneywright")
    .inner_size(400.0, 380.0)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .visible(false) // Start hidden to avoid flash
    .build();

    if let Ok(win) = window {
        let version = APP_VERSION;
        // Use correct port for logo: 3000 in dev, 17777 in production
        #[cfg(debug_assertions)]
        let logo_url = "http://localhost:3000/logo.png";
        #[cfg(not(debug_assertions))]
        let logo_url = "http://localhost:17777/logo.png";

        // Injecting static HTML into our own about window using Tauri's webview eval API
        // Colors match web app's dark mode design tokens from index.css
        // Links use data-url attributes and JavaScript click handlers to open in browser via Tauri command
        let about_html = format!(r#"
            // Save Tauri API reference before replacing document
            const tauriApi = window.__TAURI__;

            document.documentElement.innerHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>About Moneywright</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Outfit:wght@500;600&display=swap');
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #030303;
            color: #fafafa;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 40px 32px;
            user-select: none;
            -webkit-user-select: none;
        }}
        .logo-container {{
            position: relative;
            margin-bottom: 20px;
        }}
        .logo-glow {{
            position: absolute;
            inset: -8px;
            background: rgba(16, 185, 129, 0.2);
            border-radius: 24px;
            filter: blur(16px);
        }}
        .logo {{
            position: relative;
            width: 72px;
            height: 72px;
            border-radius: 16px;
        }}
        h1 {{
            font-family: 'Outfit', sans-serif;
            font-size: 22px;
            font-weight: 600;
            letter-spacing: -0.02em;
            margin-bottom: 6px;
        }}
        .version {{
            font-size: 13px;
            color: #10b981;
            font-weight: 500;
            margin-bottom: 16px;
        }}
        .description {{
            font-size: 13px;
            color: #71717a;
            line-height: 1.6;
            max-width: 280px;
            margin-bottom: 24px;
        }}
        .links {{
            display: flex;
            gap: 20px;
        }}
        .links a {{
            font-size: 13px;
            font-weight: 500;
            color: #a1a1aa;
            text-decoration: none;
            transition: color 0.15s ease;
            cursor: pointer;
        }}
        .links a:hover {{
            color: #10b981;
        }}
        .license {{
            margin-top: 24px;
            font-size: 11px;
            color: #52525b;
        }}
        .license a {{
            color: #71717a;
            text-decoration: none;
            cursor: pointer;
        }}
        .license a:hover {{
            color: #10b981;
        }}
    </style>
</head>
<body>
    <div class="logo-container">
        <div class="logo-glow"></div>
        <img src="{}" class="logo" onerror="this.parentElement.style.display='none'" />
    </div>
    <h1>Moneywright</h1>
    <div class="version">{1}</div>
    <div class="description">
        Private, AI-Powered Personal Finance Manager
    </div>
    <div class="links">
        <a data-url="https://moneywright.com">Website</a>
        <a data-url="https://github.com/moneywright/moneywright">GitHub</a>
        <a data-url="https://moneywright.com/docs">Docs</a>
    </div>
    <div class="license">Open Source · <a data-url="https://github.com/moneywright/moneywright/blob/main/LICENSE">AGPL-3.0</a></div>
</body>
</html>`;

            // Attach click handlers to all links with data-url attribute
            document.querySelectorAll('a[data-url]').forEach(link => {{
                link.addEventListener('click', (e) => {{
                    e.preventDefault();
                    const url = link.getAttribute('data-url');
                    if (url && tauriApi) {{
                        tauriApi.core.invoke('open_url', {{ url: url }});
                    }}
                }});
            }});
        "#, logo_url, version);

        let win_clone = win.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            // Using Tauri's webview eval API to inject static HTML - safe as content is hardcoded
            let _ = win_clone.eval(&about_html);
            // Show window after content is injected
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            let _ = win_clone.show();
            let _ = win_clone.set_focus();
        });
    }
}

/// Check for updates and show result
fn trigger_update_check(app: &AppHandle) {
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        check_for_updates(app_clone).await;
    });
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
            open_url,
            get_logs,
            clear_logs,
            quit_app_cmd,
            download_update,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();

            // Create log store
            #[allow(unused_variables)]
            let log_store: SharedLogStore = Arc::new(Mutex::new(LogStore::new()));
            app.manage(log_store.clone());

            // Create server manager with app handle (for data directory)
            let server_manager = create_server_manager(&handle);
            app.manage(server_manager.clone());

            // Setup menu
            setup_menu(&handle)?;

            // In debug/dev mode, skip starting sidecar - use external dev servers
            // Run `bun run dev` separately to start API (17777) and Web (3000)
            #[cfg(debug_assertions)]
            {
                println!("Dev mode: Skipping sidecar startup. Make sure `bun run dev` is running.");
                println!("  - API: http://localhost:17777");
                println!("  - Web: http://localhost:3000");
            }

            // In release mode, start the sidecar server
            #[cfg(not(debug_assertions))]
            {
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
            }

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
                        // Windows/Linux: Quit app and kill server (only in release mode)
                        #[cfg(not(debug_assertions))]
                        let _ = kill_process_on_port(SERVER_PORT);
                        window.app_handle().exit(0);
                    }
                }
            }
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "about" => open_about_window(app),
                "check_updates" => trigger_update_check(app),
                "refresh" => refresh_main_window(app),
                "open_browser" => {
                    let _ = open::that(get_server_url());
                }
                "logs" => open_logs_window(app),
                "clear_cookies" => clear_cookies(app),
                "quit" => {
                    // Kill server process synchronously before exit (only in release mode)
                    #[cfg(not(debug_assertions))]
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
                    // Only in release mode - don't kill dev servers
                    #[cfg(not(debug_assertions))]
                    let _ = kill_process_on_port(SERVER_PORT);
                }
                _ => {}
            }
        });
}

fn setup_menu(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // App submenu (macOS)
    let about = MenuItem::with_id(app, "about", "About Moneywright", true, None::<&str>)?;
    let check_updates = MenuItem::with_id(app, "check_updates", "Check for Updates...", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Moneywright", true, Some("CmdOrCtrl+Q"))?;

    let app_menu = Submenu::with_items(
        app,
        "Moneywright",
        true,
        &[
            &about,
            &check_updates,
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
    let clear_cookies = MenuItem::with_id(app, "clear_cookies", "Clear Cookies", true, None::<&str>)?;

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
            &PredefinedMenuItem::separator(app)?,
            &clear_cookies,
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
