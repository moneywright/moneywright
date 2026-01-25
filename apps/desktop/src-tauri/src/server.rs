// Server process manager for the Moneywright sidecar binary

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use serde::Serialize;
use crate::SharedLogStore;

#[derive(Clone, Serialize)]
struct LogPayload {
    message: String,
    log_type: String,
}

/// Emit a log message to the frontend and store it
fn emit_log(app: &AppHandle, message: &str, log_type: &str) {
    let _ = app.emit("server-log", LogPayload {
        message: message.to_string(),
        log_type: log_type.to_string(),
    });
}

/// Store a log message
async fn store_log(log_store: &SharedLogStore, message: &str) {
    let mut store = log_store.lock().await;
    store.add(message.to_string());
}

pub const SERVER_PORT: u16 = 17777;
const STARTUP_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, PartialEq)]
pub enum ServerStatus {
    Starting,
    Running,
    Stopped,
    Error(String),
}

pub struct ServerManager {
    child: Option<CommandChild>,
    status: ServerStatus,
    data_dir: PathBuf,
}

impl ServerManager {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            child: None,
            status: ServerStatus::Stopped,
            data_dir,
        }
    }

    pub fn status(&self) -> &ServerStatus {
        &self.status
    }

    pub fn is_running(&self) -> bool {
        matches!(self.status, ServerStatus::Running)
    }

    pub fn data_dir(&self) -> &PathBuf {
        &self.data_dir
    }
}

pub type SharedServerManager = Arc<Mutex<ServerManager>>;

/// Get the appropriate data directory for the desktop app
/// - macOS: ~/Library/Application Support/Moneywright
/// - Windows: %APPDATA%\Moneywright
/// - Linux: ~/.local/share/moneywright
pub fn get_data_dir(app: &tauri::AppHandle) -> PathBuf {
    // Use Tauri's app data directory
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| {
            // Fallback to home directory
            dirs::home_dir()
                .map(|h| h.join(".moneywright"))
                .unwrap_or_else(|| PathBuf::from("."))
        })
}

/// Check if a CLI installation exists that we could migrate from
/// CLI installs to:
/// - macOS: ~/.moneywright
/// - Linux: ~/.local/share/moneywright or ~/.moneywright
/// - Windows: %LOCALAPPDATA%\Moneywright
pub fn get_cli_install_dir() -> Option<PathBuf> {
    let home = dirs::home_dir()?;

    // Check common CLI install locations
    let candidates = vec![
        home.join(".moneywright"),
        home.join(".local/share/moneywright"),
    ];

    #[cfg(windows)]
    let candidates = {
        let mut c = candidates;
        if let Some(local_app_data) = dirs::data_local_dir() {
            c.push(local_app_data.join("Moneywright"));
        }
        c
    };

    for candidate in candidates {
        if candidate.exists() && candidate.join("data").exists() {
            return Some(candidate);
        }
    }

    None
}

/// Initialize the data directory, creating necessary subdirectories
pub fn init_data_dir(data_dir: &PathBuf) -> Result<(), String> {
    // Create main data directory
    fs::create_dir_all(data_dir)
        .map_err(|e| format!("Failed to create data directory: {}", e))?;

    // Create subdirectories
    fs::create_dir_all(data_dir.join("data"))
        .map_err(|e| format!("Failed to create data/data directory: {}", e))?;

    // Create drizzle directory for migrations
    fs::create_dir_all(data_dir.join("drizzle"))
        .map_err(|e| format!("Failed to create drizzle directory: {}", e))?;

    Ok(())
}

/// Read DATABASE_URL from .env file if it exists
pub fn read_database_url(data_dir: &PathBuf) -> Option<String> {
    let env_path = data_dir.join(".env");
    if !env_path.exists() {
        return None;
    }

    let content = fs::read_to_string(&env_path).ok()?;
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with("DATABASE_URL=") {
            return Some(line.trim_start_matches("DATABASE_URL=").to_string());
        }
    }

    None
}

/// Write DATABASE_URL to .env file
pub fn write_database_url(data_dir: &PathBuf, database_url: &str) -> Result<(), String> {
    let env_path = data_dir.join(".env");

    let content = if env_path.exists() {
        let existing = fs::read_to_string(&env_path)
            .map_err(|e| format!("Failed to read .env: {}", e))?;

        // Update existing DATABASE_URL or append
        let mut found = false;
        let lines: Vec<String> = existing
            .lines()
            .map(|line| {
                if line.trim().starts_with("DATABASE_URL=") {
                    found = true;
                    format!("DATABASE_URL={}", database_url)
                } else {
                    line.to_string()
                }
            })
            .collect();

        if found {
            lines.join("\n")
        } else {
            format!("{}\n\n# PostgreSQL database URL\nDATABASE_URL={}", existing.trim(), database_url)
        }
    } else {
        format!("# PostgreSQL database URL\nDATABASE_URL={}", database_url)
    };

    fs::write(&env_path, content)
        .map_err(|e| format!("Failed to write .env: {}", e))?;

    Ok(())
}

pub fn create_server_manager(app: &tauri::AppHandle) -> SharedServerManager {
    let data_dir = get_data_dir(app);

    // Initialize data directory
    if let Err(e) = init_data_dir(&data_dir) {
        eprintln!("Warning: {}", e);
    }

    println!("Data directory: {:?}", data_dir);

    Arc::new(Mutex::new(ServerManager::new(data_dir)))
}

/// Start the moneywright server sidecar
pub async fn start_server(
    app: tauri::AppHandle,
    manager: SharedServerManager,
    log_store: SharedLogStore,
) -> Result<(), String> {
    let mut mgr = manager.lock().await;

    if mgr.is_running() {
        return Ok(());
    }

    mgr.status = ServerStatus::Starting;

    let data_dir = mgr.data_dir.clone();

    // Get the sidecar command
    let shell = app.shell();
    let mut sidecar = shell
        .sidecar("moneywright")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .env("PORT", SERVER_PORT.to_string())
        .env("DATA_DIR", data_dir.to_string_lossy().to_string());

    // Set DATABASE_URL if configured
    let is_postgres = if let Some(database_url) = read_database_url(&data_dir) {
        sidecar = sidecar.env("DATABASE_URL", database_url);
        emit_log(&app, "Using PostgreSQL database", "info");
        store_log(&log_store, "Using PostgreSQL database").await;
        true
    } else {
        emit_log(&app, "Using SQLite database", "info");
        store_log(&log_store, "Using SQLite database").await;
        false
    };

    // Set paths from app resources
    if let Ok(resource_dir) = app.path().resource_dir() {
        let migrations_type = if is_postgres { "pg" } else { "sqlite" };
        let migrations_path = resource_dir.join("drizzle").join(migrations_type);
        let public_path = resource_dir.join("public");
        let log_msg = format!("Data directory: {}", data_dir.display());
        emit_log(&app, &log_msg, "info");
        store_log(&log_store, &log_msg).await;
        sidecar = sidecar.env("MIGRATIONS_PATH", migrations_path.to_string_lossy().to_string());
        sidecar = sidecar.env("PUBLIC_DIR", public_path.to_string_lossy().to_string());
    }

    // Spawn the sidecar process
    let (mut rx, child) = sidecar
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    mgr.child = Some(child);

    // Drop the lock before spawning the output handler
    drop(mgr);

    // Spawn a task to handle stdout/stderr
    let manager_clone = manager.clone();
    let app_clone = app.clone();
    let log_store_clone = log_store.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line).trim().to_string();
                    if !line_str.is_empty() {
                        let log_line = format!("[moneywright] {}", line_str);
                        println!("{}", log_line);
                        emit_log(&app_clone, &line_str, "server");
                        store_log(&log_store_clone, &log_line).await;

                        // Check if server is ready
                        if line_str.contains("Listening on") || line_str.contains("Server running") || line_str.contains("Server is running") {
                            let mut mgr = manager_clone.lock().await;
                            mgr.status = ServerStatus::Running;
                        }
                    }
                }
                CommandEvent::Stderr(line) => {
                    let line_str = String::from_utf8_lossy(&line).trim().to_string();
                    if !line_str.is_empty() {
                        let log_line = format!("[moneywright:err] {}", line_str);
                        eprintln!("{}", log_line);
                        emit_log(&app_clone, &line_str, "error");
                        store_log(&log_store_clone, &log_line).await;
                    }
                }
                CommandEvent::Terminated(payload) => {
                    let mut mgr = manager_clone.lock().await;
                    if let Some(code) = payload.code {
                        if code != 0 {
                            let msg = format!("Server exited with code {}", code);
                            emit_log(&app_clone, &msg, "error");
                            store_log(&log_store_clone, &msg).await;
                            mgr.status = ServerStatus::Error(msg);
                        } else {
                            emit_log(&app_clone, "Server stopped", "info");
                            store_log(&log_store_clone, "Server stopped").await;
                            mgr.status = ServerStatus::Stopped;
                        }
                    } else {
                        emit_log(&app_clone, "Server terminated", "info");
                        store_log(&log_store_clone, "Server terminated").await;
                        mgr.status = ServerStatus::Stopped;
                    }
                    mgr.child = None;
                    break;
                }
                _ => {}
            }
        }
    });

    // Wait for server to be ready (with timeout)
    let start = std::time::Instant::now();
    loop {
        if start.elapsed() > STARTUP_TIMEOUT {
            return Err("Server startup timed out".to_string());
        }

        let mgr = manager.lock().await;
        match &mgr.status {
            ServerStatus::Running => return Ok(()),
            ServerStatus::Error(e) => return Err(e.clone()),
            ServerStatus::Stopped => return Err("Server stopped unexpectedly".to_string()),
            ServerStatus::Starting => {
                drop(mgr);
                std::thread::sleep(Duration::from_millis(100));
            }
        }
    }
}

/// Stop the moneywright server
pub async fn stop_server(manager: SharedServerManager) -> Result<(), String> {
    let mut mgr = manager.lock().await;

    if let Some(child) = mgr.child.take() {
        child.kill().map_err(|e| format!("Failed to kill server: {}", e))?;
    }

    mgr.status = ServerStatus::Stopped;
    Ok(())
}

/// Get the server URL
pub fn get_server_url() -> String {
    format!("http://localhost:{}", SERVER_PORT)
}
