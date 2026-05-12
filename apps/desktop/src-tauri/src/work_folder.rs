use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

// ============================================================================
// Types
// ============================================================================

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WatcherEvent {
    pub path: String,
    pub event_kind: String, // "create" | "modify" | "rename" | "remove"
}

/// Shared watcher state — held in Tauri managed state so stop_watcher can cancel it.
pub struct WatcherState {
    pub stop_tx: Option<std::sync::mpsc::Sender<()>>,
}

impl WatcherState {
    pub fn new() -> Self {
        WatcherState { stop_tx: None }
    }
}

// ============================================================================
// Commands
// ============================================================================

/// Create the work folder directory at the given path.
/// Returns an error string if creation fails.
#[tauri::command]
pub fn setup_work_folder(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    std::fs::create_dir_all(&p).map_err(|e| format!("Failed to create folder: {}", e))
}

/// Write a hidden marker file `.taskflow-id` inside the folder.
/// Content is a JSON object: { "userId": "...", "version": 1 }
/// This lets the app find the folder even if it's renamed or moved (Desktop only).
#[tauri::command]
pub fn write_marker_file(folder_path: String, user_id: String) -> Result<(), String> {
    let marker = PathBuf::from(&folder_path).join(".taskflow-id");
    let content = format!("{{\"userId\":\"{}\",\"version\":1}}", user_id);
    std::fs::write(&marker, content).map_err(|e| format!("Failed to write marker: {}", e))?;

    // On Windows, set the file hidden attribute via SetFileAttributesW
    #[cfg(target_os = "windows")]
    {
        // FILE_ATTRIBUTE_HIDDEN = 0x2
        let wide: Vec<u16> = marker.to_string_lossy()
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        unsafe {
            #[link(name = "kernel32")]
            extern "system" {
                fn SetFileAttributesW(lpFileName: *const u16, dwFileAttributes: u32) -> i32;
            }
            SetFileAttributesW(wide.as_ptr(), 0x2); // FILE_ATTRIBUTE_HIDDEN
        }
    }

    Ok(())
}

/// Scan the user's Desktop (one level deep) for a folder containing a
/// `.taskflow-id` file whose `userId` field matches the given userId.
/// Returns the folder path if found, or None if not.
/// Used to auto-relocate the work folder after an accidental rename/move.
#[tauri::command]
pub fn find_work_folder_by_marker(user_id: String) -> Option<String> {
    let desktop = dirs::desktop_dir()?;

    let entries = std::fs::read_dir(&desktop).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let marker = path.join(".taskflow-id");
        if !marker.exists() {
            continue;
        }
        // Read and parse the marker
        if let Ok(contents) = std::fs::read_to_string(&marker) {
            // Simple string match — avoid pulling in serde_json for this one field
            let needle = format!("\"userId\":\"{}\"", user_id);
            if contents.contains(&needle) {
                return Some(path.to_string_lossy().to_string());
            }
        }
    }
    None
}

/// Check whether the path at `folder_path` exists on disk.
#[tauri::command]
pub fn check_folder_exists(path: String) -> bool {
    PathBuf::from(&path).is_dir()
}

/// Open the given folder path in the OS file explorer.
#[tauri::command]
pub fn open_folder_in_explorer(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| e.to_string())
}

/// Returns true if the given path appears to be inside a cloud sync folder
/// (Dropbox, OneDrive, Google Drive). Used to show a warning during setup.
#[tauri::command]
pub fn check_path_is_sync_folder(path: String) -> bool {
    let lower = path.to_lowercase();
    // Common sync folder name fragments
    let markers = ["dropbox", "onedrive", "google drive", "googledrive", "icloud"];
    markers.iter().any(|m| lower.contains(m))
}

/// Get the default suggested work folder path for a user.
/// Returns: `~/Desktop/TaskFlow - {user_name}/`
#[tauri::command]
pub fn get_default_folder_path(user_name: String) -> String {
    // Sanitize name: replace characters that are invalid in directory names
    let safe_name: String = user_name
        .chars()
        .map(|c| {
            if matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') {
                '_'
            } else {
                c
            }
        })
        .collect();

    let desktop = dirs::desktop_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));

    desktop
        .join(format!("TaskFlow - {}", safe_name))
        .to_string_lossy()
        .to_string()
}

/// Open OS native folder picker dialog and return the selected path.
/// Returns None if user cancelled.
/// Uses the blocking variant — Tauri commands run on a thread pool, not the main thread.
#[tauri::command]
pub fn pick_folder(app: AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().to_string())
}

/// Start watching the work folder for file system events.
/// Events are emitted to the frontend as `work-folder-event` with a `WatcherEvent` payload.
/// Only one watcher runs at a time; calling start_watcher while one is running is a no-op.
#[tauri::command]
pub fn start_watcher(
    app: AppHandle,
    folder_path: String,
    state: tauri::State<'_, Arc<Mutex<WatcherState>>>,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|_| "Failed to acquire watcher lock".to_string())?;

    // Already running — no-op
    if guard.stop_tx.is_some() {
        return Ok(());
    }

    let (stop_tx, stop_rx) = std::sync::mpsc::channel::<()>();
    guard.stop_tx = Some(stop_tx);
    drop(guard); // release lock before spawning thread

    let app_clone = app.clone();
    let watch_path = folder_path.clone();

    std::thread::spawn(move || {
        use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
        use notify::event::{CreateKind, ModifyKind, RemoveKind, RenameMode};

        let (tx, rx) = std::sync::mpsc::channel();

        let mut watcher = match RecommendedWatcher::new(tx, Config::default()) {
            Ok(w) => w,
            Err(e) => {
                let _ = app_clone.emit("work-folder-watcher-error", e.to_string());
                return;
            }
        };

        let path = PathBuf::from(&watch_path);
        if let Err(e) = watcher.watch(&path, RecursiveMode::Recursive) {
            let _ = app_clone.emit("work-folder-watcher-error", e.to_string());
            return;
        }

        loop {
            // Check for stop signal (non-blocking)
            if stop_rx.try_recv().is_ok() {
                break;
            }

            // Poll for fs events with 200ms timeout
            match rx.recv_timeout(std::time::Duration::from_millis(200)) {
                Ok(Ok(event)) => {
                    let kind_str = match &event.kind {
                        EventKind::Create(CreateKind::File) => "create",
                        EventKind::Create(_) => "create",
                        EventKind::Modify(ModifyKind::Data(_)) => "modify",
                        EventKind::Modify(ModifyKind::Name(RenameMode::To)) => "rename",
                        EventKind::Modify(_) => "modify",
                        EventKind::Remove(RemoveKind::File) => "remove",
                        EventKind::Remove(_) => "remove",
                        _ => continue,
                    };

                    for path in &event.paths {
                        let payload = WatcherEvent {
                            path: path.to_string_lossy().to_string(),
                            event_kind: kind_str.to_string(),
                        };
                        let _ = app_clone.emit("work-folder-event", payload);
                    }
                }
                Ok(Err(e)) => {
                    let _ = app_clone.emit("work-folder-watcher-error", e.to_string());
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // No event — loop back and check stop signal
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    break;
                }
            }
        }

        // Signal frontend that watcher stopped
        let _ = app_clone.emit("work-folder-watcher-stopped", ());
    });

    Ok(())
}

/// Stop the running file watcher.
#[tauri::command]
pub fn stop_watcher(
    state: tauri::State<'_, Arc<Mutex<WatcherState>>>,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|_| "Failed to acquire watcher lock".to_string())?;
    if let Some(tx) = guard.stop_tx.take() {
        let _ = tx.send(());
    }
    Ok(())
}

/// Read a file from the work folder as raw bytes.
/// Used by the sync engine to compute checksums and upload blobs.
#[tauri::command]
pub fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Get file metadata: size and last-modified timestamp (ISO 8601 string).
#[tauri::command]
pub fn get_file_metadata(path: String) -> Result<FileMetadata, String> {
    let meta = std::fs::metadata(&path).map_err(|e| format!("Failed to read metadata: {}", e))?;

    // Detect symlinks — do not follow them
    let symlink_meta = std::fs::symlink_metadata(&path)
        .map_err(|e| format!("Failed to read symlink metadata: {}", e))?;
    if symlink_meta.file_type().is_symlink() {
        return Err("symlink".to_string());
    }

    let size = meta.len();

    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .and_then(|d| {
            use chrono::TimeZone;
            chrono::Utc.timestamp_opt(d.as_secs() as i64, 0).single()
        })
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default();

    Ok(FileMetadata { size, modified })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    pub size: u64,
    pub modified: String,
}

/// Walk a directory recursively and return all file paths (not directories, not symlinks).
#[tauri::command]
pub fn walk_directory(dir_path: String) -> Result<Vec<String>, String> {
    let root = PathBuf::from(&dir_path);
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", dir_path));
    }

    let mut files = Vec::new();
    walk_dir_inner(&root, &mut files).map_err(|e| e.to_string())?;
    Ok(files)
}

fn walk_dir_inner(dir: &PathBuf, out: &mut Vec<String>) -> std::io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        // Skip symlinks
        let symlink_meta = std::fs::symlink_metadata(&path)?;
        if symlink_meta.file_type().is_symlink() {
            continue;
        }

        if path.is_dir() {
            walk_dir_inner(&path, out)?;
        } else if path.is_file() {
            out.push(path.to_string_lossy().to_string());
        }
    }
    Ok(())
}

// ============================================================================
// Tray
// ============================================================================

/// Update the work folder status label shown in the tray tooltip.
///
/// The frontend calls this whenever the sync state changes (syncing, failed,
/// queued, all-synced). Using the tooltip rather than rebuilding the menu item
/// text is portable across platforms and avoids holding a mutable menu reference.
///
/// Requires the tray to be created with id "taskflow-tray" in lib.rs.
#[tauri::command]
pub fn update_tray_work_folder_label(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("taskflow-tray") {
        tray.set_tooltip(Some(&label)).map_err(|e| e.to_string())?;
    }
    Ok(())
}
