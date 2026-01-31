// Auto-update functionality for Moneywright Desktop

use tauri::{Runtime, Manager, WebviewUrl, WebviewWindowBuilder, Emitter};
use tauri_plugin_updater::UpdaterExt;
use serde::Serialize;

#[derive(Clone, Serialize)]
struct DownloadProgress {
    downloaded: usize,
    total: Option<u64>,
    percent: f64,
}

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

/// Show dialog when update is available
fn show_update_available<R: Runtime>(app: &tauri::AppHandle<R>, current: &str, new_version: &str, body: Option<&str>) {
    let notes = body.unwrap_or("Bug fixes and improvements");
    let html = format!(r#"
        window._tauri = window.__TAURI__;

        document.documentElement.innerHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Outfit:wght@500;600&display=swap');
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #09090b;
            color: #fafafa;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px;
            overflow: hidden;
        }}
        .container {{
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            width: 100%;
            max-width: 300px;
        }}
        .icon-wrapper {{
            width: 64px;
            height: 64px;
            border-radius: 16px;
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
            border: 1px solid rgba(16, 185, 129, 0.2);
        }}
        .icon {{
            font-size: 28px;
            line-height: 1;
        }}
        h2 {{
            font-family: 'Outfit', sans-serif;
            font-size: 18px;
            font-weight: 600;
            letter-spacing: -0.01em;
            margin-bottom: 6px;
            color: #fafafa;
        }}
        .version {{
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #10b981;
            font-weight: 500;
            margin-bottom: 12px;
        }}
        .version-arrow {{
            color: #3f3f46;
        }}
        .notes {{
            font-size: 13px;
            color: #71717a;
            line-height: 1.6;
            margin-bottom: 28px;
        }}
        .progress-container {{
            width: 100%;
            display: none;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
        }}
        .progress-bar {{
            width: 100%;
            height: 4px;
            background: #27272a;
            border-radius: 2px;
            overflow: hidden;
        }}
        .progress-fill {{
            height: 100%;
            background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
            border-radius: 2px;
            width: 0%;
            transition: width 0.2s ease;
        }}
        .progress-text {{
            font-size: 12px;
            color: #a1a1aa;
            font-variant-numeric: tabular-nums;
        }}
        .status {{
            font-size: 13px;
            color: #a1a1aa;
            margin-bottom: 8px;
            display: none;
        }}
        .buttons {{
            display: flex;
            gap: 10px;
            width: 100%;
        }}
        button {{
            flex: 1;
            padding: 12px 20px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            transition: all 0.15s ease;
        }}
        .primary {{
            background: #10b981;
            color: #022c22;
        }}
        .primary:hover:not(:disabled) {{
            background: #059669;
        }}
        .primary:disabled {{
            opacity: 0.5;
            cursor: not-allowed;
        }}
        .secondary {{
            background: #18181b;
            color: #a1a1aa;
            border: 1px solid #27272a;
        }}
        .secondary:hover {{
            background: #27272a;
            color: #fafafa;
        }}
        .error-container {{
            display: none;
            width: 100%;
            padding: 12px;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 8px;
            margin-bottom: 20px;
        }}
        .error-text {{
            font-size: 12px;
            color: #fca5a5;
            line-height: 1.5;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="icon-wrapper">
            <span class="icon" id="icon">✨</span>
        </div>
        <h2 id="title">Update Available</h2>
        <div class="version" id="versionInfo">
            <span>{}</span>
            <span class="version-arrow">→</span>
            <span>{}</span>
        </div>
        <div class="notes" id="notes">{}</div>
        <div class="progress-container" id="progressContainer">
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            <div class="progress-text" id="progressText">0%</div>
        </div>
        <div class="status" id="status"></div>
        <div class="error-container" id="errorContainer">
            <div class="error-text" id="errorText"></div>
        </div>
        <div class="buttons" id="buttons">
            <button class="secondary" id="laterBtn">Later</button>
            <button class="primary" id="updateBtn">Update</button>
        </div>
    </div>
</body>
</html>`;

        const $ = id => document.getElementById(id);

        // Listen for download progress events
        window._tauri.event.listen('update-progress', (event) => {{
            const {{ percent }} = event.payload;
            $('progressFill').style.width = percent + '%';
            $('progressText').textContent = Math.round(percent) + '%';
        }});

        $('laterBtn').onclick = () => window._tauri.window.getCurrentWindow().close();

        $('updateBtn').onclick = async () => {{
            // Transition to downloading state
            $('updateBtn').disabled = true;
            $('updateBtn').textContent = 'Updating...';
            $('laterBtn').style.display = 'none';
            $('notes').style.display = 'none';
            $('versionInfo').style.display = 'none';
            $('progressContainer').style.display = 'flex';
            $('icon').textContent = '⬇️';
            $('title').textContent = 'Downloading...';

            try {{
                await window._tauri.core.invoke('download_update');
                // Success - app will restart
                $('progressContainer').style.display = 'none';
                $('icon').textContent = '✓';
                $('title').textContent = 'Restarting...';
                $('status').style.display = 'block';
                $('status').textContent = 'Update installed successfully';
                $('buttons').style.display = 'none';
            }} catch (e) {{
                // Error state
                $('progressContainer').style.display = 'none';
                $('icon').textContent = '✕';
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

    open_update_window(app, "Software Update", 340.0, 320.0, &html);
}

/// Show dialog when no update is available
fn show_no_update<R: Runtime>(app: &tauri::AppHandle<R>) {
    let html = r#"
        window._tauri = window.__TAURI__;

        document.documentElement.innerHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Outfit:wght@500;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #09090b;
            color: #fafafa;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px;
        }
        .icon-wrapper {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
            border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .icon {
            font-size: 28px;
            color: #10b981;
        }
        h2 {
            font-family: 'Outfit', sans-serif;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .message {
            font-size: 13px;
            color: #71717a;
            margin-bottom: 28px;
        }
        button {
            padding: 12px 32px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            background: #18181b;
            color: #a1a1aa;
            border: 1px solid #27272a;
            transition: all 0.15s ease;
        }
        button:hover {
            background: #27272a;
            color: #fafafa;
        }
    </style>
</head>
<body>
    <div class="icon-wrapper">
        <span class="icon">✓</span>
    </div>
    <h2>You're Up to Date</h2>
    <div class="message">Moneywright is running the latest version.</div>
    <button onclick="window._tauri.window.getCurrentWindow().close()">OK</button>
</body>
</html>`;
    "#.to_string();

    open_update_window(app, "Software Update", 320.0, 260.0, &html);
}

/// Show dialog when update check fails
fn show_update_error<R: Runtime>(app: &tauri::AppHandle<R>, error: &str) {
    let html = format!(r#"
        window._tauri = window.__TAURI__;

        document.documentElement.innerHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Outfit:wght@500;600&display=swap');
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #09090b;
            color: #fafafa;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px;
        }}
        .icon-wrapper {{
            width: 64px;
            height: 64px;
            border-radius: 16px;
            background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.05) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
            border: 1px solid rgba(239, 68, 68, 0.2);
        }}
        .icon {{
            font-size: 28px;
        }}
        h2 {{
            font-family: 'Outfit', sans-serif;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 12px;
        }}
        .error-box {{
            padding: 12px 16px;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 8px;
            margin-bottom: 24px;
            max-width: 280px;
        }}
        .error-text {{
            font-size: 12px;
            color: #fca5a5;
            line-height: 1.5;
            word-break: break-word;
        }}
        button {{
            padding: 12px 32px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            background: #18181b;
            color: #a1a1aa;
            border: 1px solid #27272a;
            transition: all 0.15s ease;
        }}
        button:hover {{
            background: #27272a;
            color: #fafafa;
        }}
    </style>
</head>
<body>
    <div class="icon-wrapper">
        <span class="icon">✕</span>
    </div>
    <h2>Update Check Failed</h2>
    <div class="error-box">
        <div class="error-text">{}</div>
    </div>
    <button onclick="window._tauri.window.getCurrentWindow().close()">OK</button>
</body>
</html>`;
    "#, error);

    open_update_window(app, "Software Update", 340.0, 300.0, &html);
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
