// Server process manager for the Moneywright sidecar binary

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::async_runtime::Mutex;
use tauri::Manager;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

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
    if let Some(database_url) = read_database_url(&data_dir) {
        sidecar = sidecar.env("DATABASE_URL", database_url);
        println!("Using PostgreSQL database");
    } else {
        println!("Using SQLite database (default)");
    }

    // Set working directory to data_dir so relative paths work
    sidecar = sidecar.env("MONEYWRIGHT_DATA_DIR", data_dir.to_string_lossy().to_string());

    // Spawn the sidecar process
    let (mut rx, child) = sidecar
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    mgr.child = Some(child);

    // Drop the lock before spawning the output handler
    drop(mgr);

    // Spawn a task to handle stdout/stderr
    let manager_clone = manager.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    println!("[moneywright] {}", line_str);

                    // Check if server is ready
                    if line_str.contains("Listening on") || line_str.contains("Server running") {
                        let mut mgr = manager_clone.lock().await;
                        mgr.status = ServerStatus::Running;
                    }
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("[moneywright:err] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Terminated(payload) => {
                    let mut mgr = manager_clone.lock().await;
                    if let Some(code) = payload.code {
                        if code != 0 {
                            mgr.status = ServerStatus::Error(format!("Process exited with code {}", code));
                        } else {
                            mgr.status = ServerStatus::Stopped;
                        }
                    } else {
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
