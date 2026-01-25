// Auto-update functionality for Moneywright Desktop

use tauri::Runtime;
use tauri_plugin_updater::UpdaterExt;

/// Check for updates in the background
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

                    // Store update info for tray menu to display
                    // For now, just log it - in a full implementation,
                    // we'd update the tray menu to show "Update Available"
                    println!("Update body: {:?}", update.body);
                }
                Ok(None) => {
                    println!("No updates available, running latest version");
                }
                Err(e) => {
                    eprintln!("Failed to check for updates: {}", e);
                }
            }
        }
        Err(e) => {
            eprintln!("Failed to create updater: {}", e);
        }
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
