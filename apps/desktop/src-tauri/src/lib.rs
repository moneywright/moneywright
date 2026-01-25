// Moneywright Desktop - System tray app for running the Moneywright server

mod server;
mod tray;
mod updater;

use server::{create_server_manager, get_server_url, start_server, stop_server};
use tray::create_tray;
use updater::check_for_updates;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(move |app| {
            let handle = app.handle().clone();

            // Create server manager with app handle (for data directory)
            let server_manager = create_server_manager(&handle);
            app.manage(server_manager.clone());

            let manager = server_manager.clone();

            // Create system tray
            create_tray(&handle)?;

            // Start the server in background
            let manager_clone = manager.clone();
            let handle_clone = handle.clone();
            tauri::async_runtime::spawn(async move {
                match start_server(handle_clone.clone(), manager_clone.clone()).await {
                    Ok(_) => {
                        println!("Moneywright server started successfully");
                        // Open browser to the app
                        let url = get_server_url();
                        if let Err(e) = open::that(&url) {
                            eprintln!("Failed to open browser: {}", e);
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to start server: {}", e);
                    }
                }
            });

            // Check for updates in background (non-blocking)
            tauri::async_runtime::spawn(async move {
                // Small delay to let the app fully initialize
                std::thread::sleep(std::time::Duration::from_secs(3));
                check_for_updates(handle).await;
            });

            Ok(())
        })
        .on_window_event(|_window, _event| {
            // No windows, so nothing to handle
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                // Stop the server when app is quitting
                let manager = app.state::<server::SharedServerManager>().inner().clone();
                tauri::async_runtime::block_on(async {
                    if let Err(e) = stop_server(manager).await {
                        eprintln!("Error stopping server: {}", e);
                    }
                });
            }
        });
}
