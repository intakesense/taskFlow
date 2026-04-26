// Prevents additional console window on Windows, DO NOT REMOVE!!
#![windows_subsystem = "windows"]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use std::path::PathBuf;
use std::collections::HashMap;
use std::sync::Mutex;

// ============================================================================
// Image Cache for Notifications
// ============================================================================

static IMAGE_CACHE: Mutex<Option<HashMap<String, PathBuf>>> = Mutex::new(None);

fn get_cache_dir() -> Option<PathBuf> {
    dirs::cache_dir().map(|d| d.join("taskflow").join("notification-images"))
}

fn hash_url(url: &str) -> String {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    url.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Download image from URL and cache locally (required for Windows notifications)
#[cfg(target_os = "windows")]
fn download_and_cache_image(url: &str) -> Option<PathBuf> {
    // Check cache first
    {
        let mut cache = IMAGE_CACHE.lock().ok()?;
        if cache.is_none() {
            *cache = Some(HashMap::new());
        }
        if let Some(ref map) = *cache {
            if let Some(path) = map.get(url) {
                if path.exists() {
                    return Some(path.clone());
                }
            }
        }
    }

    // Create cache directory
    let cache_dir = get_cache_dir()?;
    std::fs::create_dir_all(&cache_dir).ok()?;

    // Determine file extension
    let ext = if url.contains(".png") { "png" }
              else if url.contains(".gif") { "gif" }
              else if url.contains(".webp") { "webp" }
              else { "jpg" };

    let file_path = cache_dir.join(format!("{}.{}", hash_url(url), ext));

    // Download if not exists
    if !file_path.exists() {
        let response = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .ok()?
            .get(url)
            .send()
            .ok()?;

        if !response.status().is_success() {
            return None;
        }
        let bytes = response.bytes().ok()?;
        std::fs::write(&file_path, &bytes).ok()?;
    }

    // Update cache
    {
        let mut cache = IMAGE_CACHE.lock().ok()?;
        if let Some(ref mut map) = *cache {
            map.insert(url.to_string(), file_path.clone());
        }
    }

    Some(file_path)
}

// ============================================================================
// Notification Payload & Commands
// ============================================================================

#[derive(serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NotificationPayload {
    pub title: String,
    pub body: String,
    /// Notification type: "message", "task", "progress", "mention", "assignment"
    pub notification_type: Option<String>,
    /// Target ID for navigation (conversation_id or task_id)
    pub target_id: Option<String>,
    /// Sender name for grouping
    pub sender_name: Option<String>,
    /// Avatar URL (profile picture - circular like WhatsApp)
    pub avatar_url: Option<String>,
    /// Image URL (photo attachment - hero image preview)
    pub image_url: Option<String>,
}

/// Show rich notification on Windows with circular avatar and image preview
#[cfg(target_os = "windows")]
#[tauri::command]
fn show_notification(_app: tauri::AppHandle, payload: NotificationPayload) -> Result<(), String> {
    use tauri_winrt_notification::{Toast, Duration, IconCrop};

    let mut toast = Toast::new("com.taskflow.desktop")
        .title(&payload.title)
        .text1(&payload.body)
        .duration(Duration::Short);

    // Avatar as circular icon (WhatsApp-style profile picture)
    if let Some(ref avatar_url) = payload.avatar_url {
        if let Some(avatar_path) = download_and_cache_image(avatar_url) {
            toast = toast.icon(&avatar_path, IconCrop::Circular, "");
        }
    }

    // Hero image for photo attachments
    if let Some(ref image_url) = payload.image_url {
        if let Some(image_path) = download_and_cache_image(image_url) {
            toast = toast.hero(&image_path, "");
        }
    }

    toast.show().map_err(|e| e.to_string())
}

/// Fallback notification for non-Windows platforms
#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn show_notification(app: tauri::AppHandle, payload: NotificationPayload) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    app.notification()
        .builder()
        .title(&payload.title)
        .body(&payload.body)
        .show()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_oauth_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_stronghold::Builder::new(|password| {
            use argon2::{Argon2, password_hash::{PasswordHasher, SaltString}};
            let salt = SaltString::from_b64("dGFza2Zsb3ctc2FsdC12MQ").unwrap();
            let argon2 = Argon2::default();
            argon2.hash_password(password.as_bytes(), &salt)
                .map(|hash| hash.hash.unwrap().as_bytes().to_vec())
                .unwrap_or_else(|_| password.as_bytes().to_vec())
        }).build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_deep_link::init())
        // Single instance: when another instance is launched with deep link,
        // pass the URL to the existing instance
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // argv contains the command line arguments
            // On Windows, deep link URL is passed as an argument
            if let Some(url) = argv.iter().find(|arg| arg.starts_with("taskflow://")) {
                // Emit to frontend
                let _ = app.emit("auth-callback", url);

                // Focus the existing window
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        }))
        .setup(|app| {
            // Register deep link scheme on Windows/Linux
            #[cfg(any(target_os = "linux", target_os = "windows"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register("taskflow");
            }

            // Check command line arguments
            let args: Vec<String> = std::env::args().collect();

            // Handle --minimized flag (from autostart)
            let start_minimized = args.iter().any(|arg| arg == "--minimized");
            if start_minimized {
                // Hide the main window on startup (start in tray)
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            // Check if app was launched with a deep link URL (first launch)
            if let Some(url) = args.iter().find(|arg| arg.starts_with("taskflow://")) {
                let url = url.clone();
                let handle = app.handle().clone();
                // Delay emit until frontend is ready
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    let _ = handle.emit("auth-callback", &url);
                });
            }

            // Build system tray menu
            let show_item = MenuItem::with_id(app, "show", "Open TaskFlow", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // Create tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide window instead of closing when user clicks X
            if let WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap_or_default();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![show_notification, open_oauth_url]);

    match builder.run(tauri::generate_context!()) {
        Ok(()) => {}
        Err(e) => {
            let error_msg = format!("TaskFlow failed to start:\n\n{}", e);

            #[cfg(target_os = "windows")]
            {
                use std::ptr::null_mut;
                use std::ffi::CString;

                #[link(name = "user32")]
                extern "system" {
                    fn MessageBoxA(hwnd: *mut (), text: *const i8, caption: *const i8, utype: u32) -> i32;
                }

                let text = CString::new(error_msg.clone()).unwrap_or_default();
                let caption = CString::new("TaskFlow Error").unwrap_or_default();

                unsafe {
                    MessageBoxA(null_mut(), text.as_ptr(), caption.as_ptr(), 0x10);
                }
            }

            if let Some(config_dir) = dirs::config_dir() {
                let log_path = config_dir.join("taskflow").join("error.log");
                let _ = std::fs::create_dir_all(log_path.parent().unwrap());
                let _ = std::fs::write(&log_path, &error_msg);
            }

            eprintln!("{}", error_msg);
            std::process::exit(1);
        }
    }
}
