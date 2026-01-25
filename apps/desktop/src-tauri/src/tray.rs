// System tray implementation for Moneywright

use crate::server::{get_server_url, SharedServerManager};
use crate::updater::check_for_updates;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Runtime,
};

const MENU_OPEN: &str = "open";
const MENU_STATUS: &str = "status";
const MENU_CHECK_UPDATES: &str = "check_updates";
const MENU_QUIT: &str = "quit";

pub fn create_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    // Create menu items
    let open_item = MenuItem::with_id(app, MENU_OPEN, "Open Moneywright", true, None::<&str>)?;
    let status_item = MenuItem::with_id(app, MENU_STATUS, "Status: Starting...", false, None::<&str>)?;
    let separator1 = tauri::menu::PredefinedMenuItem::separator(app)?;
    let check_updates_item = MenuItem::with_id(app, MENU_CHECK_UPDATES, "Check for Updates", true, None::<&str>)?;
    let separator2 = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, MENU_QUIT, "Quit", true, None::<&str>)?;

    // Build menu
    let menu = Menu::with_items(app, &[&open_item, &status_item, &separator1, &check_updates_item, &separator2, &quit_item])?;

    // Build tray icon
    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("Moneywright")
        .on_menu_event(move |app, event| {
            match event.id.as_ref() {
                MENU_OPEN => {
                    // Open browser to server URL
                    let url = get_server_url();
                    if let Err(e) = open::that(&url) {
                        eprintln!("Failed to open browser: {}", e);
                    }
                }
                MENU_CHECK_UPDATES => {
                    // Check for updates
                    let handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        check_for_updates(handle).await;
                    });
                }
                MENU_QUIT => {
                    // Quit the application
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|_tray, event| {
            // Handle left-click on tray icon (open browser)
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let url = get_server_url();
                if let Err(e) = open::that(&url) {
                    eprintln!("Failed to open browser: {}", e);
                }
            }
        })
        .build(app)?;

    Ok(())
}

/// Update the tray menu status based on server state
pub async fn update_tray_status(
    manager: &SharedServerManager,
) {
    let mgr = manager.lock().await;
    let status = mgr.status();

    let status_text = if mgr.is_running() {
        "Status: Running"
    } else {
        "Status: Stopped"
    };

    // Log the status - tray menu status update would require rebuilding menu
    println!("Server status: {:?} - {}", status, status_text);
}
