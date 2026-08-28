// School ERP — desktop shell.
//
// Two modes:
//   * Dev (cargo run / tauri dev): the WebView loads the Vite dev server at
//     http://localhost:3000. The Rust process is a thin shell; the backend
//     server is started separately (npm run dev in server/).
//   * Prod (cargo build --release / tauri build): the WebView loads the
//     prebuilt web/dist files bundled into the app via tauri.conf.json's
//     `resources`. `tauri::api::process::Command` would be the right hook for
//     spawning the bundled school-erp-server on app launch; we leave that as
//     an explicit operation (double-click server.exe, then desktop shell) so
//     LAN deployments can upgrade the backend independently of the shell.

use serde::Serialize;
use tauri::{CustomMenuItem, Manager, Menu, MenuItem, Submenu};

#[derive(Serialize)]
struct AppInfo {
    name: &'static str,
    version: &'static str,
    mode: &'static str,
}

#[tauri::command]
fn app_info() -> AppInfo {
    let mode = if cfg!(debug_assertions) { "dev" } else { "prod" };
    AppInfo {
        name: "School ERP",
        version: env!("CARGO_PKG_VERSION"),
        mode,
    }
}

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    // open::that is part of tauri::api::shell in v1.6 and is allow-listed
    // via the `shell.open` permission in tauri.conf.json.
    tauri::api::shell::open(&url, None).map_err(|e| e.to_string())
}

fn build_menu() -> Menu {
    let new_session = CustomMenuItem::new("new-session".to_string(), "Open in Browser");
    let about = CustomMenuItem::new("about".to_string(), "About School ERP");
    let file = Submenu::new(
        "File",
        Menu::new()
            .add_item(new_session)
            .add_native_item(MenuItem::Quit),
    );
    let help = Submenu::new(
        "Help",
        Menu::new().add_item(about),
    );
    Menu::new()
        .add_submenu(file)
        .add_submenu(help)
}

fn main() {
    tauri::Builder::default()
        .menu(build_menu())
        .on_menu_event(|event| match event.menu_item_id() {
            "new-session" => {
                let _ = tauri::api::shell::open("http://localhost:3000", None);
            }
            "about" => {
                let _ = event.window().emit("about", ());
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![app_info, open_external])
        .setup(|app| {
            // In dev mode the main window opens onto the Vite dev server.
            // In prod it opens onto the bundled web/dist (configured via
            // tauri.conf.json -> build.distDir).
            if let Some(win) = app.get_window("main") {
                let _ = win.set_title("School ERP");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running School ERP desktop shell");
}
