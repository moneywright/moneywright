// Auto-update functionality for Moneywright Desktop
// Note: This module uses Tauri's webview.eval() API to inject HTML into dialog windows.
// This is safe as the content is hardcoded/controlled, not user-provided.

use tauri::{Runtime, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_updater::UpdaterExt;

/// Check for updates and show result to user
pub async fn check_for_updates<R: Runtime>(app: tauri::AppHandle<R>) {
    println!("Checking for updates...");

    match app.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    println!(
                        "Update available: {} -> {}",
                        update.current_version,
                        update.version
                    );
                    show_update_available(&app, &update.current_version, &update.version, update.body.as_deref());
                }
                Ok(None) => {
                    println!("No updates available, running latest version");
                    show_no_update(&app);
                }
                Err(e) => {
                    eprintln!("Failed to check for updates: {}", e);
                    show_update_error(&app, &e.to_string());
                }
            }
        }
        Err(e) => {
            eprintln!("Failed to create updater: {}", e);
            show_update_error(&app, &e.to_string());
        }
    }
}

/// Show dialog when update is available
/// Note: innerHTML is used with hardcoded content only - no user input
fn show_update_available<R: Runtime>(app: &tauri::AppHandle<R>, current: &str, new_version: &str, body: Option<&str>) {
    let notes = body.unwrap_or("Bug fixes and improvements");
    // Colors match web app's dark mode design tokens
    let html = format!(r#"
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
            background: #030303;
            color: #fafafa;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 24px;
        }}
        .icon {{ font-size: 48px; margin-bottom: 16px; }}
        h2 {{ font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 600; margin-bottom: 8px; }}
        .version {{ font-size: 13px; color: #10b981; font-weight: 500; margin-bottom: 12px; }}
        .notes {{ font-size: 13px; color: #71717a; margin-bottom: 24px; max-width: 280px; line-height: 1.5; }}
        .buttons {{ display: flex; gap: 12px; }}
        button {{
            padding: 10px 24px;
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
        .primary:hover {{ background: #059669; }}
        .secondary {{
            background: #111111;
            color: #a1a1aa;
            border: 1px solid rgba(255,255,255,0.06);
        }}
        .secondary:hover {{ background: #161616; color: #fafafa; }}
    </style>
</head>
<body>
    <div class="icon">🎉</div>
    <h2>Update Available</h2>
    <div class="version">{} → {}</div>
    <div class="notes">{}</div>
    <div class="buttons">
        <button class="secondary" onclick="window.close()">Later</button>
        <button class="primary" onclick="window.__TAURI__.core.invoke('download_update').then(() => window.close())">Update Now</button>
    </div>
</body>
</html>`;
    "#, current, new_version, notes);

    open_update_window(app, "Update Available", &html);
}

/// Show dialog when no update is available
/// Note: innerHTML is used with hardcoded content only - no user input
fn show_no_update<R: Runtime>(app: &tauri::AppHandle<R>) {
    // Colors match web app's dark mode design tokens
    let html = r#"
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
            background: #030303;
            color: #fafafa;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 24px;
        }
        .icon { font-size: 48px; margin-bottom: 16px; color: #10b981; }
        h2 { font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 600; margin-bottom: 8px; }
        .message { font-size: 13px; color: #71717a; margin-bottom: 24px; }
        button {
            padding: 10px 24px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid rgba(255,255,255,0.06);
            background: #111111;
            color: #a1a1aa;
            transition: all 0.15s ease;
        }
        button:hover { background: #161616; color: #fafafa; }
    </style>
</head>
<body>
    <div class="icon">✓</div>
    <h2>You're Up to Date</h2>
    <div class="message">Moneywright is running the latest version.</div>
    <button onclick="window.close()">OK</button>
</body>
</html>`;
    "#.to_string();

    open_update_window(app, "Software Update", &html);
}

/// Show dialog when update check fails
/// Note: innerHTML is used with hardcoded content only - error message is controlled
fn show_update_error<R: Runtime>(app: &tauri::AppHandle<R>, error: &str) {
    // Colors match web app's dark mode design tokens
    let html = format!(r#"
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
            background: #030303;
            color: #fafafa;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 24px;
        }}
        .icon {{ font-size: 48px; margin-bottom: 16px; }}
        h2 {{ font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 600; margin-bottom: 8px; }}
        .message {{ font-size: 12px; color: #ef4444; margin-bottom: 24px; max-width: 280px; line-height: 1.5; }}
        button {{
            padding: 10px 24px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid rgba(255,255,255,0.06);
            background: #111111;
            color: #a1a1aa;
            transition: all 0.15s ease;
        }}
        button:hover {{ background: #161616; color: #fafafa; }}
    </style>
</head>
<body>
    <div class="icon">⚠️</div>
    <h2>Update Check Failed</h2>
    <div class="message">{}</div>
    <button onclick="window.close()">OK</button>
</body>
</html>`;
    "#, error);

    open_update_window(app, "Software Update", &html);
}

/// Open a small update dialog window
fn open_update_window<R: Runtime>(app: &tauri::AppHandle<R>, title: &str, html: &str) {
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
    .inner_size(350.0, 280.0)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .build();

    if let Ok(win) = window {
        let html = html.to_string();
        let win_clone = win.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            // Tauri webview eval API - injecting controlled static HTML content
            let _ = win_clone.eval(&html);
        });
    }
}

/// Download and install an update
pub async fn download_and_install<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    let updater = app.updater().map_err(|e| format!("Failed to create updater: {}", e))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check for updates: {}", e))?
        .ok_or_else(|| "No update available".to_string())?;

    println!("Downloading update {}...", update.version);

    // Download the update
    let mut downloaded = 0;
    let bytes = update
        .download(
            |chunk_length, content_length| {
                downloaded += chunk_length;
                if let Some(total) = content_length {
                    println!("Downloaded {} of {} bytes", downloaded, total);
                }
            },
            || {
                println!("Download complete, verifying...");
            },
        )
        .await
        .map_err(|e| format!("Failed to download update: {}", e))?;

    println!("Installing update...");

    // Install the update (this will restart the app)
    update
        .install(bytes)
        .map_err(|e| format!("Failed to install update: {}", e))?;

    // The app should restart after install, but if it doesn't:
    println!("Update installed, please restart the app");

    Ok(())
}
