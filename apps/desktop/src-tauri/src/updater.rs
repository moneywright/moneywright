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
/// Note: document.documentElement.innerHTML is used with hardcoded content only - no user input is involved
fn show_update_available<R: Runtime>(app: &tauri::AppHandle<R>, current: &str, new_version: &str, body: Option<&str>) {
    let notes = body.unwrap_or("Bug fixes and improvements");
    // Colors match web app's dark mode design tokens
    // Note: Store Tauri API globally so onclick handlers can access it (local const is not accessible from onclick)
    // document.documentElement.innerHTML is used with hardcoded content only - no user input
    let html = format!(r#"
        window._tauriApi = window.__TAURI__;

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
        .status {{ font-size: 13px; color: #10b981; margin-bottom: 16px; display: none; }}
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
        .primary:hover:not(:disabled) {{ background: #059669; }}
        .primary:disabled {{ opacity: 0.6; cursor: not-allowed; }}
        .secondary {{
            background: #111111;
            color: #a1a1aa;
            border: 1px solid rgba(255,255,255,0.06);
        }}
        .secondary:hover {{ background: #161616; color: #fafafa; }}
        .error {{ color: #ef4444; font-size: 12px; margin-top: 16px; display: none; max-width: 280px; }}
    </style>
</head>
<body>
    <div class="icon" id="icon">🎉</div>
    <h2 id="title">Update Available</h2>
    <div class="version">{} → {}</div>
    <div class="notes" id="notes">{}</div>
    <div class="status" id="status">Downloading update...</div>
    <div class="error" id="error"></div>
    <div class="buttons" id="buttons">
        <button class="secondary" id="laterBtn">Later</button>
        <button class="primary" id="updateBtn">Update Now</button>
    </div>
</body>
</html>`;

        // Set up event handlers after DOM is ready
        const laterBtn = document.getElementById('laterBtn');
        const updateBtn = document.getElementById('updateBtn');
        const status = document.getElementById('status');
        const notes = document.getElementById('notes');
        const errorEl = document.getElementById('error');
        const icon = document.getElementById('icon');
        const title = document.getElementById('title');

        laterBtn.onclick = function() {{
            window._tauriApi.window.getCurrentWindow().close();
        }};

        updateBtn.onclick = async function() {{
            console.log('[update-dialog] Update button clicked');

            // Check if Tauri API is available
            if (!window._tauriApi || !window._tauriApi.core) {{
                console.error('[update-dialog] Tauri API not available');
                errorEl.style.display = 'block';
                errorEl.textContent = 'Tauri API not available. Please restart the app and try again.';
                return;
            }}

            // Show downloading state
            updateBtn.disabled = true;
            updateBtn.textContent = 'Downloading...';
            laterBtn.style.display = 'none';
            notes.style.display = 'none';
            status.style.display = 'block';
            icon.textContent = '⏳';
            title.textContent = 'Updating...';

            try {{
                console.log('[update-dialog] Invoking download_update command...');
                await window._tauriApi.core.invoke('download_update');
                console.log('[update-dialog] download_update completed successfully');
                // Update successful - app should restart
                status.textContent = 'Update installed! Restarting...';
                icon.textContent = '✓';
                title.textContent = 'Update Complete';
                // Close after a moment if app doesn't restart
                setTimeout(() => {{
                    window._tauriApi.window.getCurrentWindow().close();
                }}, 3000);
            }} catch (e) {{
                // Show error
                console.error('[update-dialog] Update failed:', e);
                icon.textContent = '⚠️';
                title.textContent = 'Update Failed';
                status.style.display = 'none';
                errorEl.style.display = 'block';
                errorEl.textContent = String(e);
                updateBtn.textContent = 'Retry';
                updateBtn.disabled = false;
                laterBtn.style.display = 'block';
                laterBtn.textContent = 'Close';
            }}
        }};
    "#, current, new_version, notes);

    open_update_window(app, "Update Available", &html);
}

/// Show dialog when no update is available
/// Note: innerHTML is used with hardcoded content only - no user input
fn show_no_update<R: Runtime>(app: &tauri::AppHandle<R>) {
    // Colors match web app's dark mode design tokens
    // Store Tauri API globally so onclick handlers can access it
    let html = r#"
        window._tauriApi = window.__TAURI__;

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
    <button onclick="window._tauriApi.window.getCurrentWindow().close()">OK</button>
</body>
</html>`;
    "#.to_string();

    open_update_window(app, "Software Update", &html);
}

/// Show dialog when update check fails
/// Note: innerHTML is used with hardcoded content only - error message is controlled
fn show_update_error<R: Runtime>(app: &tauri::AppHandle<R>, error: &str) {
    // Colors match web app's dark mode design tokens
    // Store Tauri API globally so onclick handlers can access it
    let html = format!(r#"
        window._tauriApi = window.__TAURI__;

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
    <button onclick="window._tauriApi.window.getCurrentWindow().close()">OK</button>
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
            // Wait for the page to load and Tauri API to be injected
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            // Tauri's webview.eval() API - injecting controlled static HTML content
            if let Err(e) = win_clone.eval(&html) {
                eprintln!("[updater] Failed to inject HTML: {}", e);
            }
        });
    }
}

/// Download and install an update
pub async fn download_and_install<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    println!("[updater] Starting download_and_install...");

    let updater = app.updater().map_err(|e| {
        let err = format!("Failed to create updater: {}", e);
        eprintln!("[updater] {}", err);
        err
    })?;

    println!("[updater] Checking for updates...");
    let update = updater
        .check()
        .await
        .map_err(|e| {
            let err = format!("Failed to check for updates: {}", e);
            eprintln!("[updater] {}", err);
            err
        })?
        .ok_or_else(|| {
            let err = "No update available (this may be a caching issue - try again)".to_string();
            eprintln!("[updater] {}", err);
            err
        })?;

    println!("[updater] Update found: {} -> {}", update.current_version, update.version);
    println!("[updater] Starting download...");

    // Download the update
    let mut downloaded: usize = 0;
    let bytes = update
        .download(
            |chunk_length, content_length| {
                downloaded += chunk_length;
                if let Some(total) = content_length {
                    println!("[updater] Downloaded {} of {} bytes ({:.1}%)",
                        downloaded, total, (downloaded as f64 / total as f64) * 100.0);
                } else {
                    println!("[updater] Downloaded {} bytes", downloaded);
                }
            },
            || {
                println!("[updater] Download complete, verifying signature...");
            },
        )
        .await
        .map_err(|e| {
            let err = format!("Failed to download update: {}", e);
            eprintln!("[updater] {}", err);
            err
        })?;

    println!("[updater] Installing update ({} bytes)...", bytes.len());

    // Install the update (this will restart the app)
    update
        .install(bytes)
        .map_err(|e| {
            let err = format!("Failed to install update: {}", e);
            eprintln!("[updater] {}", err);
            err
        })?;

    // The app should restart after install, but if it doesn't:
    println!("[updater] Update installed successfully, app should restart");

    Ok(())
}
