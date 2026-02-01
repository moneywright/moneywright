// Auto-update functionality for Moneywright Desktop

use tauri::{Runtime, Manager, WebviewUrl, WebviewWindowBuilder, Emitter};
use tauri_plugin_updater::UpdaterExt;
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Clone, Serialize)]
struct DownloadProgress {
    downloaded: usize,
    total: Option<u64>,
    percent: f64,
}

#[derive(Clone, Serialize, Debug)]
pub struct UpdateReadyInfo {
    pub current_version: String,
    pub new_version: String,
    pub body: Option<String>,
}

/// State to track if an update has been downloaded and installed (ready for restart)
pub struct UpdateState {
    pub ready: Option<UpdateReadyInfo>,
}

impl UpdateState {
    pub fn new() -> Self {
        Self { ready: None }
    }
}

pub type SharedUpdateState = Arc<Mutex<UpdateState>>;

/// Check for updates and show result to user
pub async fn check_for_updates<R: Runtime>(app: tauri::AppHandle<R>) {
    match app.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    show_update_available(&app, &update.current_version, &update.version, update.body.as_deref());
                }
                Ok(None) => {
                    show_no_update(&app);
                }
                Err(e) => {
                    show_update_error(&app, &e.to_string());
                }
            }
        }
        Err(e) => {
            show_update_error(&app, &e.to_string());
        }
    }
}

/// Download and install update in background (without restart)
/// Returns update info if successful
pub async fn background_download_and_install<R: Runtime>(app: tauri::AppHandle<R>) -> Result<UpdateReadyInfo, String> {
    let updater = app.updater().map_err(|e| format!("Failed to initialize updater: {}", e))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check for updates: {}", e))?
        .ok_or_else(|| "No update available".to_string())?;

    let info = UpdateReadyInfo {
        current_version: update.current_version.to_string(),
        new_version: update.version.to_string(),
        body: update.body.clone(),
    };

    // Download with progress reporting
    let app_clone = app.clone();
    let mut downloaded: usize = 0;

    let bytes = update
        .download(
            move |chunk_length, content_length| {
                downloaded += chunk_length;
                let percent = if let Some(total) = content_length {
                    (downloaded as f64 / total as f64) * 100.0
                } else {
                    0.0
                };
                let _ = app_clone.emit("background-update-progress", DownloadProgress {
                    downloaded,
                    total: content_length,
                    percent,
                });
            },
            || {},
        )
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    // Install the update (stages it for next restart)
    update.install(bytes).map_err(|e| format!("Install failed: {}", e))?;

    // Emit that update is ready
    let _ = app.emit("update-ready", &info);

    Ok(info)
}

/// Show dialog when update is available
fn show_update_available<R: Runtime>(app: &tauri::AppHandle<R>, current: &str, new_version: &str, body: Option<&str>) {
    let notes = body.unwrap_or("Bug fixes and improvements");
    // Note: HTML content is static/hardcoded with only version strings from Tauri updater API
    let html = format!(r#"
        window._tauri = window.__TAURI__;

        document.documentElement.innerHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Outfit:wght@500;600;700&display=swap');
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(145deg, #050806 0%, #030303 50%, #040504 100%);
            color: #fafafa;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 32px;
            overflow: hidden;
            position: relative;
        }}
        body::before {{
            content: '';
            position: absolute;
            top: -100px;
            right: -100px;
            width: 300px;
            height: 300px;
            background: radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%);
            pointer-events: none;
        }}
        body::after {{
            content: '';
            position: absolute;
            bottom: -80px;
            left: -80px;
            width: 250px;
            height: 250px;
            background: radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%);
            pointer-events: none;
        }}
        .container {{
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            width: 100%;
            max-width: 320px;
            position: relative;
            z-index: 1;
        }}
        .icon-wrapper {{
            position: relative;
            margin-bottom: 24px;
        }}
        .icon-glow {{
            position: absolute;
            inset: -8px;
            background: rgba(16, 185, 129, 0.4);
            border-radius: 20px;
            filter: blur(20px);
            animation: pulse 2s ease-in-out infinite;
        }}
        @keyframes pulse {{
            0%, 100% {{ opacity: 0.4; transform: scale(1); }}
            50% {{ opacity: 0.6; transform: scale(1.05); }}
        }}
        @keyframes shimmer {{
            0% {{ background-position: 200% 0; }}
            100% {{ background-position: -200% 0; }}
        }}
        .icon-box {{
            position: relative;
            width: 72px;
            height: 72px;
            border-radius: 18px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 32px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255,255,255,0.1);
        }}
        .icon-box svg {{
            width: 32px;
            height: 32px;
            color: white;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        }}
        h2 {{
            font-family: 'Outfit', sans-serif;
            font-size: 22px;
            font-weight: 600;
            letter-spacing: -0.02em;
            margin-bottom: 12px;
            color: #fafafa;
        }}
        .version {{
            display: inline-flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
        }}
        .version-badge {{
            display: inline-flex;
            align-items: center;
            padding: 6px 12px;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.25);
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            color: #34d399;
        }}
        .version-arrow svg {{
            width: 16px;
            height: 16px;
            color: #3f3f46;
        }}
        .version-new {{
            color: #10b981;
        }}
        .notes {{
            font-size: 13px;
            color: #71717a;
            line-height: 1.7;
            margin-bottom: 32px;
            max-width: 280px;
        }}
        .progress-container {{
            width: 100%;
            display: none;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            margin-bottom: 24px;
        }}
        .progress-track {{
            width: 100%;
            height: 6px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 3px;
            overflow: hidden;
        }}
        .progress-fill {{
            height: 100%;
            background: linear-gradient(90deg, #10b981 0%, #34d399 50%, #10b981 100%);
            background-size: 200% 100%;
            border-radius: 3px;
            width: 0%;
            transition: width 0.3s ease;
            box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
            animation: shimmer 2s linear infinite;
        }}
        .progress-info {{
            display: flex;
            justify-content: space-between;
            width: 100%;
            font-size: 12px;
            color: #71717a;
        }}
        .progress-percent {{
            font-variant-numeric: tabular-nums;
            color: #a1a1aa;
            font-weight: 500;
        }}
        .status {{
            font-size: 14px;
            color: #a1a1aa;
            margin-bottom: 8px;
            display: none;
        }}
        .buttons {{
            display: flex;
            gap: 12px;
            width: 100%;
        }}
        button {{
            flex: 1;
            padding: 14px 24px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            transition: all 0.2s ease;
        }}
        .primary {{
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #022c22;
            box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255,255,255,0.15);
        }}
        .primary:hover:not(:disabled) {{
            transform: translateY(-1px);
            box-shadow: 0 6px 24px rgba(16, 185, 129, 0.4);
        }}
        .primary:disabled {{
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }}
        .secondary {{
            background: rgba(255, 255, 255, 0.05);
            color: #a1a1aa;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }}
        .secondary:hover {{
            background: rgba(255, 255, 255, 0.08);
            color: #fafafa;
        }}
        .error-container {{
            display: none;
            width: 100%;
            padding: 14px 16px;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 12px;
            margin-bottom: 24px;
        }}
        .error-text {{
            font-size: 12px;
            color: #fca5a5;
            line-height: 1.6;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="icon-wrapper">
            <div class="icon-glow" id="iconGlow"></div>
            <div class="icon-box" id="iconBox">
                <svg id="iconSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
            </div>
        </div>
        <h2 id="title">Update Available</h2>
        <div class="version" id="versionInfo">
            <span class="version-badge">{}</span>
            <span class="version-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
            </span>
            <span class="version-badge version-new">{}</span>
        </div>
        <div class="notes" id="notes">{}</div>
        <div class="progress-container" id="progressContainer">
            <div class="progress-track">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            <div class="progress-info">
                <span id="progressLabel">Downloading...</span>
                <span class="progress-percent" id="progressText">0%</span>
            </div>
        </div>
        <div class="status" id="status"></div>
        <div class="error-container" id="errorContainer">
            <div class="error-text" id="errorText"></div>
        </div>
        <div class="buttons" id="buttons">
            <button class="secondary" id="laterBtn">Later</button>
            <button class="primary" id="updateBtn">Install Update</button>
        </div>
    </div>
</body>
</html>`;

        const $ = id => document.getElementById(id);

        window._tauri.event.listen('update-progress', (event) => {{
            const {{ percent }} = event.payload;
            $('progressFill').style.width = percent + '%';
            $('progressText').textContent = Math.round(percent) + '%';
            if (percent > 99) {{
                $('progressLabel').textContent = 'Installing...';
            }}
        }});

        $('laterBtn').onclick = () => window._tauri.window.getCurrentWindow().close();

        $('updateBtn').onclick = async () => {{
            $('updateBtn').disabled = true;
            $('updateBtn').textContent = 'Downloading...';
            $('laterBtn').style.display = 'none';
            $('notes').style.display = 'none';
            $('versionInfo').style.display = 'none';
            $('progressContainer').style.display = 'flex';
            $('title').textContent = 'Downloading Update';

            try {{
                await window._tauri.core.invoke('download_update');
                $('progressContainer').style.display = 'none';
                $('iconGlow').style.background = 'rgba(16, 185, 129, 0.5)';
                $('iconSvg').innerHTML = '<polyline points="20 6 9 17 4 12"/>';
                $('title').textContent = 'Restarting...';
                $('status').style.display = 'block';
                $('status').textContent = 'Update installed successfully';
                $('buttons').style.display = 'none';
            }} catch (e) {{
                $('progressContainer').style.display = 'none';
                $('iconGlow').style.background = 'rgba(239, 68, 68, 0.4)';
                $('iconBox').style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                $('iconSvg').innerHTML = '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
                $('title').textContent = 'Update Failed';
                $('errorContainer').style.display = 'block';
                $('errorText').textContent = String(e);
                $('updateBtn').textContent = 'Retry';
                $('updateBtn').disabled = false;
                $('laterBtn').style.display = 'block';
                $('laterBtn').textContent = 'Close';
            }}
        }};
    "#, current, new_version, notes);

    open_update_window(app, "Software Update", 380.0, 400.0, &html);
}

/// Show dialog when no update is available
fn show_no_update<R: Runtime>(app: &tauri::AppHandle<R>) {
    // Note: HTML content is entirely static/hardcoded
    let html = r#"
        window._tauri = window.__TAURI__;

        document.documentElement.innerHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Outfit:wght@500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(145deg, #050806 0%, #030303 50%, #040504 100%);
            color: #fafafa;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 32px;
            position: relative;
            overflow: hidden;
        }
        body::before {
            content: '';
            position: absolute;
            top: -80px;
            right: -80px;
            width: 250px;
            height: 250px;
            background: radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%);
            pointer-events: none;
        }
        .container {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            position: relative;
            z-index: 1;
        }
        .icon-wrapper {
            position: relative;
            margin-bottom: 24px;
        }
        .icon-glow {
            position: absolute;
            inset: -8px;
            background: rgba(16, 185, 129, 0.35);
            border-radius: 20px;
            filter: blur(18px);
        }
        .icon-box {
            position: relative;
            width: 72px;
            height: 72px;
            border-radius: 18px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 32px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .icon-box svg {
            width: 36px;
            height: 36px;
            color: white;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        }
        h2 {
            font-family: 'Outfit', sans-serif;
            font-size: 22px;
            font-weight: 600;
            letter-spacing: -0.02em;
            margin-bottom: 8px;
        }
        .message {
            font-size: 14px;
            color: #71717a;
            margin-bottom: 32px;
            line-height: 1.5;
        }
        button {
            padding: 14px 40px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            background: rgba(255, 255, 255, 0.05);
            color: #a1a1aa;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.2s ease;
        }
        button:hover {
            background: rgba(255, 255, 255, 0.08);
            color: #fafafa;
            border-color: rgba(255, 255, 255, 0.15);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon-wrapper">
            <div class="icon-glow"></div>
            <div class="icon-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            </div>
        </div>
        <h2>You're Up to Date</h2>
        <div class="message">Moneywright is running the latest version.</div>
        <button onclick="window._tauri.window.getCurrentWindow().close()">Done</button>
    </div>
</body>
</html>`;
    "#.to_string();

    open_update_window(app, "Software Update", 360.0, 320.0, &html);
}

/// Show dialog when update check fails
fn show_update_error<R: Runtime>(app: &tauri::AppHandle<R>, error: &str) {
    // Note: HTML content is static except for error message from Tauri updater API
    let html = format!(r#"
        window._tauri = window.__TAURI__;

        document.documentElement.innerHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Outfit:wght@500;600;700&display=swap');
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(145deg, #080505 0%, #030303 50%, #050404 100%);
            color: #fafafa;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 32px;
            position: relative;
            overflow: hidden;
        }}
        body::before {{
            content: '';
            position: absolute;
            top: -80px;
            right: -80px;
            width: 250px;
            height: 250px;
            background: radial-gradient(circle, rgba(239, 68, 68, 0.1) 0%, transparent 70%);
            pointer-events: none;
        }}
        .container {{
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            max-width: 320px;
            position: relative;
            z-index: 1;
        }}
        .icon-wrapper {{
            position: relative;
            margin-bottom: 24px;
        }}
        .icon-glow {{
            position: absolute;
            inset: -8px;
            background: rgba(239, 68, 68, 0.35);
            border-radius: 20px;
            filter: blur(18px);
        }}
        .icon-box {{
            position: relative;
            width: 72px;
            height: 72px;
            border-radius: 18px;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 32px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255,255,255,0.1);
        }}
        .icon-box svg {{
            width: 32px;
            height: 32px;
            color: white;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        }}
        h2 {{
            font-family: 'Outfit', sans-serif;
            font-size: 22px;
            font-weight: 600;
            letter-spacing: -0.02em;
            margin-bottom: 16px;
        }}
        .error-box {{
            width: 100%;
            padding: 14px 16px;
            background: rgba(239, 68, 68, 0.08);
            border: 1px solid rgba(239, 68, 68, 0.15);
            border-radius: 12px;
            margin-bottom: 28px;
        }}
        .error-text {{
            font-size: 12px;
            color: #fca5a5;
            line-height: 1.6;
            word-break: break-word;
        }}
        button {{
            padding: 14px 40px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            background: rgba(255, 255, 255, 0.05);
            color: #a1a1aa;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.2s ease;
        }}
        button:hover {{
            background: rgba(255, 255, 255, 0.08);
            color: #fafafa;
            border-color: rgba(255, 255, 255, 0.15);
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="icon-wrapper">
            <div class="icon-glow"></div>
            <div class="icon-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </div>
        </div>
        <h2>Update Check Failed</h2>
        <div class="error-box">
            <div class="error-text">{}</div>
        </div>
        <button onclick="window._tauri.window.getCurrentWindow().close()">Close</button>
    </div>
</body>
</html>`;
    "#, error);

    open_update_window(app, "Software Update", 380.0, 360.0, &html);
}

/// Open a small update dialog window
fn open_update_window<R: Runtime>(app: &tauri::AppHandle<R>, title: &str, width: f64, height: f64, html: &str) {
    // Close existing update window if any
    if let Some(window) = app.get_webview_window("update") {
        let _ = window.close();
    }

    let window = WebviewWindowBuilder::new(
        app,
        "update",
        WebviewUrl::App("/".into()),
    )
    .title(title)
    .inner_size(width, height)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .visible(false)
    .build();

    if let Ok(win) = window {
        let html = html.to_string();
        let win_clone = win.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            let _ = win_clone.eval(&html);
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            let _ = win_clone.show();
            let _ = win_clone.set_focus();
        });
    }
}

/// Download and install an update with progress reporting
pub async fn download_and_install<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    let updater = app.updater().map_err(|e| format!("Failed to initialize updater: {}", e))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check for updates: {}", e))?
        .ok_or_else(|| "No update available".to_string())?;

    // Download with progress reporting
    let app_clone = app.clone();
    let mut downloaded: usize = 0;

    let bytes = update
        .download(
            move |chunk_length, content_length| {
                downloaded += chunk_length;
                let percent = if let Some(total) = content_length {
                    (downloaded as f64 / total as f64) * 100.0
                } else {
                    0.0
                };
                let _ = app_clone.emit("update-progress", DownloadProgress {
                    downloaded,
                    total: content_length,
                    percent,
                });
            },
            || {},
        )
        .await
        .map_err(|e| format!("{}", e))?;

    // Install the update
    update.install(bytes).map_err(|e| format!("{}", e))?;

    // Restart the app to apply the update
    app.restart();
}
