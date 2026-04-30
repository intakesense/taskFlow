# Work Folder Sync — Feature Specification

> Upload-only. Desktop → Supabase Storage. Silent on success, loud on failure.

---

## Table of Contents

1. [Overview](#overview)
2. [Guiding Principles](#guiding-principles)
3. [Storage & Tracking](#storage--tracking)
4. [Folder Setup Flow](#folder-setup-flow)
5. [Sync Engine](#sync-engine)
6. [Notification Strategy](#notification-strategy)
7. [Error Handling & Edge Cases](#error-handling--edge-cases)
8. [User-Facing Pages & UI](#user-facing-pages--ui)
9. [Admin Flow](#admin-flow)
10. [Database Schema](#database-schema)
11. [Supabase Storage](#supabase-storage)
12. [Storage Provider Abstraction](#storage-provider-abstraction)
13. [Files to Create / Modify](#files-to-create--modify)
14. [Build Order](#build-order)
15. [Known Limitations](#known-limitations)

---

## Overview

When an employee installs the TaskFlow desktop app, a **Work Folder** is created on their machine. Any file placed in it automatically uploads to Supabase Storage under that user's private prefix. No user action required after setup. When an employee leaves, all their work files are already in the cloud — ready for admin access and export.

**Direction:** Local → Cloud only. No download, no two-way sync.  
**Trigger:** OS file system events (not polling, not scheduled).  
**Audience:** ~20 employees. One machine per user.

---

## Guiding Principles

- **Silent on success.** Never notify the user when things work. Tray icon is the only success signal.
- **Loud on failure.** Every sync failure must surface to the user — OS notification if app is in tray, in-app toast if window is visible.
- **Never block the user.** Sync is always background. No UI freezes, no upload progress modals.
- **Track everything.** No hard quotas enforced now. Every file's size, status, and error is recorded in the database. Use this data to decide on limits later.
- **Never hard-delete from Supabase.** Files deleted locally move to `_archive/` prefix. Bytes stay forever until an admin explicitly purges.
- **Idempotent uploads.** Re-uploading an already-synced file is always safe. `upsert: true` on every upload.
- **Startup always reconciles.** The watcher covers real-time. The reconciliation pass covers everything that changed while the app was closed.

---

## Storage & Tracking

### Supabase Storage Bucket

- **Bucket name:** `work-files`
- **Visibility:** Private (no public access)
- **Structure:**
  ```
  work-files/
    {userId}/
      reports/Q1-2025.pdf
      contracts/nda-client.docx
      _archive/
        deleted-file.xlsx
  ```
- Path in storage always mirrors path relative to the local work folder root.

### Local Manifest

- Stored via **Tauri Store plugin** (already installed) at key `work-folder-manifest`
- Per-file entry: `{ localPath, storageKey, checksum, lastSyncedAt, status }`
- Written **after** confirmed upload success only
- If manifest is lost/corrupted → reconciliation re-uploads everything → safe by design

### Database Tracking Table

- Table: `work_folder_files` (see [Database Schema](#database-schema))
- Every file has a row: size, checksum, status, error message, retry count
- This is the admin's source of truth and the basis for future quota decisions
- Admin can see per-user storage usage by summing `file_size_bytes` where `status = 'synced'`

---

## Folder Setup Flow

### First Launch Detection

- On app start, check Tauri Store for key `work-folder-configured` (boolean)
- If `false` or missing → trigger setup flow
- If `true` → verify folder still exists at stored path → if missing, show "folder moved" warning → do not auto-create

### Setup Dialog (First Run Only)

Shown as a modal over the main app window on first launch after install.

**Content:**
- Heading: "Set up your Work Folder"
- Explanation: one sentence — files placed here are automatically backed up to the company account
- Shows the proposed path: `~/Desktop/TaskFlow - {user full name}/`
- Single CTA: **"Create Work Folder"**
- Secondary link: "Choose a different location" → opens OS folder picker
  - Constraint: warn (not block) if chosen path is inside Dropbox, OneDrive, or Google Drive folder
- User cannot dismiss without choosing — this is not optional

**On Confirm:**
1. Create folder at chosen path (Tauri `fs.createDir`)
2. Write path to Tauri Store key `work-folder-path`
3. Write `work-folder-configured: true` to Tauri Store
4. Write `userId` + `folderPath` + `createdAt` to `work_folder_configs` table in DB
5. Close dialog
6. Immediately run reconciliation pass (folder is empty, so it completes instantly)
7. Start file watcher

### If Folder Already Exists at Path

- Skip creation, go straight to reconciliation + watcher start
- Do not show setup dialog again

---

## Sync Engine

### Startup Sequence (Every App Launch)

```
App launches (including from autostart)
  → Read work-folder-path from Tauri Store
  → Folder exists? → Run reconciliation pass → Start watcher
  → Folder missing? → Show "Work folder not found" persistent warning → Do not start watcher
```

### Reconciliation Pass

Runs once on every app launch, before the watcher starts.

1. Walk the entire work folder tree (recursive)
2. For each file:
   - Check against blocklist → skip if matched
   - Read local manifest for this path
   - Compute checksum (SHA-256 via Web Crypto API)
   - If no manifest entry OR checksum differs from manifest → add to upload queue
   - If manifest entry exists AND checksum matches → skip (already synced)
3. After walk completes → start the watcher
4. Queue drains in background

### File Watcher

- Implemented in Rust using `tauri-plugin-fs` watch API
- Watches the work folder path recursively
- Events forwarded to frontend via Tauri `emit()` with payload `{ path, eventKind }`
- Event kinds handled: `create`, `modify`, `rename` (target path), `remove`
- Frontend registers listener on app init, unregisters on app teardown

### Per-File Event Processing

On receiving a file event from the watcher:

1. **Filter** — run blocklist check on filename. Skip if matched.
2. **Debounce** — start/reset a 3-second timer keyed by absolute file path
3. **Timer fires** — attempt to open file with read access
   - If locked (EBUSY / access denied) → wait 5 seconds → retry open → max 3 attempts → if still locked, mark as `pending` and re-queue on next watcher event
4. **Checksum** — compute SHA-256 of file contents
5. **Compare** — check against local manifest
   - Matches → skip (no change)
   - Differs or missing → push to upload queue
6. **Remove event** → do not delete from Supabase → move to `_archive/{userId}/...` prefix → update manifest and DB row to `archived`

### Upload Queue

- Max **2 concurrent uploads** at all times
- FIFO order
- Each upload:
  1. Set DB row status → `syncing`
  2. Upload via `supabase.storage.from('work-files').upload(storageKey, fileBlob, { upsert: true })`
  3. On success:
     - Update local manifest entry (checksum, lastSyncedAt, status: synced)
     - Update DB row (status: synced, last_synced_at, file_size_bytes, error_message: null, retry_count: 0)
     - Update Zustand store → tray icon re-evaluates
  4. On failure → see [Error Handling](#error-handling--edge-cases)

### Blocklist (Files Never Synced)

| Pattern | Reason |
|---------|--------|
| Starts with `~$` | Office lock files |
| Starts with `.` | Hidden / OS files |
| Ends with `.tmp` / `.temp` | Temporary files |
| Ends with `.lock` / `.lck` | Lock files |
| Ends with `.part` | Partial downloads |
| Ends with `.swp` / `.swo` | Vim swap files |
| Ends with `.crdownload` | Chrome partial downloads |
| `Thumbs.db` | Windows thumbnail cache |
| `desktop.ini` | Windows folder config |
| `DS_Store` | macOS metadata |

### Checksum Strategy

- Algorithm: SHA-256 via `crypto.subtle.digest('SHA-256', fileBuffer)`
- No external dependency — Web Crypto API is available in Tauri WebView
- Stored in local manifest and DB row
- Used to detect real changes, prevent redundant uploads
- Do not rely on `mtime` alone — clock skew makes it unreliable

---

## Notification Strategy

### Window State Detection

Before any notification, check if the app window is currently visible.

- Window visible → use **Sonner toast** (in-app)
- Window hidden (system tray) → use **tauri-plugin-notification** (OS native)
- On Windows, use existing **tauri-winrt-notification** for richer display

### Rules

| Event | Window Visible | Window in Tray |
|-------|---------------|----------------|
| File synced successfully | Nothing | Nothing |
| Single file failed | Toast: "{filename} failed to sync. Tap to retry." | OS notification: same |
| Multiple files failed | Toast: "{n} files failed to sync." | OS notification: same |
| All failed files resolved | Nothing | Nothing |
| Work folder not found | Persistent toast (non-dismissable) | OS notification |
| User over storage warning (future) | Toast | OS notification |

### Tray Icon States

| State | Indicator |
|-------|-----------|
| All synced | Green dot |
| Upload in progress | Animated spinner / pulse |
| Files queued (offline) | Yellow dot |
| One or more failed | Red dot |
| Watcher not running (folder missing) | Red dot + distinct tooltip |

Tray tooltip on hover shows: "TaskFlow — All synced" or "TaskFlow — 2 files failed"

---

## Error Handling & Edge Cases

### Retry Strategy

| Error Type | Action |
|------------|--------|
| Network timeout / 5xx | Auto-retry: 3 attempts, backoff 1s → 2s → 4s |
| Supabase 429 (rate limit) | Wait 30s then retry once |
| File locked (EBUSY) | Wait 5s, retry open, max 3 attempts |
| Auth token expired | Refresh token silently, then retry upload once |
| Unknown error | Mark failed, surface to user, log error message to DB |

After 3 failed retries → status = `failed` → surface notification → stop retrying until user manually triggers retry or app restarts.

### Edge Cases to Handle

**Folder renamed or moved by user**
- Watcher detects watched path is invalid → emit `watcher-invalid` event to frontend
- Show persistent warning: "Work folder not found at [path]. Open Settings to relocate."
- Stop watcher. Do not auto-search. Do not create a new folder automatically.
- Settings page allows user to point to new location → re-validate → restart watcher

**Large folder dropped in (many files at once)**
- All events feed into the queue normally
- Queue processes at max 2 concurrent — no explosion
- No special handling needed beyond the queue

**App was closed, files changed, app reopens**
- Reconciliation pass on startup catches everything — this is exactly what it's for

**Network drops mid-upload**
- Supabase tus resumable protocol handles files — resumes on reconnect
- Small files (under ~6MB) just retry from start on reconnect — fast enough
- On app resume from system sleep: check all `syncing` status rows → restart their uploads

**Atomic saves (app writes temp file then renames)**
- Temp file extension caught by blocklist → skipped
- Rename event on final file → watcher fires → debounce → upload

**Folder rename (not file rename)**
- Detect rename event on a directory path
- Walk renamed directory → update storage keys for all contained files → re-sync

**Symlinks inside work folder**
- Detect symlink before processing (`fs.lstat` check)
- Skip silently — do not follow

**Office lock files (`~$document.docx`)**
- Caught by blocklist (`~$` prefix) → never attempted

**App already has two events for the same file queued**
- Per-file debounce timer means only one upload per file at a time
- Never process two uploads for the same path concurrently

**Supabase storage full (project level)**
- Upload fails with storage error
- Notify admin via DB flag / alert threshold check
- Surface to affected user: "Backup unavailable, contact admin"

**Work folder path inside another sync tool (Dropbox, OneDrive)**
- Detect on setup: check if chosen path contains known sync folder names
- Show warning toast: "This folder is inside Dropbox. Two sync tools on the same folder can cause conflicts."
- Do not block — user's choice

---

## User-Facing Pages & UI

### 1. First-Run Setup Dialog

- Modal, non-dismissable
- Shows on first launch only
- Inputs: folder path (pre-filled, editable via OS picker)
- Actions: "Create Work Folder", "Choose Different Location"
- Conflict warning if path is inside another sync folder

### 2. Settings → Work Folder Tab

Accessible from the existing Settings page. New tab alongside Appearance.

**Sections:**

**Status**
- Current sync state: "All synced", "Syncing...", "2 files failed"
- Folder path with "Open Folder" button (opens in OS file explorer)
- Storage used: total bytes synced (summed from DB)

**File List**
- Table: filename, relative path, size, status icon, last synced time
- Status icons: ✓ synced, ↑ uploading, ⏳ queued, ✗ failed
- Failed files show error reason and a "Retry" button per row
- "Retry All Failed" button at top if any failures exist
- Filter tabs: All / Failed / Archived

**Folder Management**
- "Change Work Folder Location" button → OS picker → re-validate → restart watcher
- Danger zone: "Remove Work Folder Sync" → stops watcher, removes local config, does NOT delete Supabase files

### 3. Tray Menu (Addition)

Add to existing tray context menu:
- "Work Folder: All synced ✓" (or current state) — non-clickable label
- "Open Work Folder" — opens folder in OS explorer
- "View Sync Status" — opens app window to Settings → Work Folder tab

---

## Admin Flow

### Web App — Admin User Profile Page

Route: `/admin/users/[userId]` — add new **"Work Folder"** tab.

**Overview panel:**
- Total files synced: count
- Total storage used: formatted size
- Last sync activity: relative time
- Status: Healthy / Has failures / Watcher offline / Never set up

**File browser:**
- Table: filename, path, size, checksum, status, last synced, archived flag
- Sortable by: name, size, last synced
- Filter: All / Synced / Failed / Archived
- Per-row action: "Download file" (generates signed URL, 1-hour expiry)

**Export:**
- "Export All as ZIP" button
- Triggers API route: `POST /api/admin/work-folder/export`
- Server-side: streams files from Supabase Storage through `archiver`, returns ZIP download
- Exports synced files only by default
- Checkbox option: "Include archived files"

**Offboarding checklist integration:**
- When admin marks user as inactive/offboarded, show prompt: "Download work folder before revoking access?"
- Link to export button

### Web App — Admin Dashboard (Addition)

Add a **Work Folder Health** widget to admin overview:

- Total storage used across all users: X MB
- Users with failures: list with names
- Users who never set up work folder: list
- Last activity: most recent sync across all users

---

## Database Schema

### `work_folder_configs` table

Tracks each user's work folder registration.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | unique |
| `folder_path` | text | Local OS path |
| `storage_prefix` | text | `{userId}/` |
| `configured_at` | timestamptz | |
| `last_watcher_start` | timestamptz | Updated on each app launch |
| `watcher_active` | boolean | Desktop updates this via heartbeat |

### `work_folder_files` table

One row per file, updated on every sync event.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | |
| `file_name` | text | Filename only |
| `relative_path` | text | Path relative to work folder root |
| `storage_key` | text | Full path in Supabase Storage |
| `file_size_bytes` | bigint | |
| `checksum` | text | SHA-256 hex |
| `status` | text | `synced` / `syncing` / `pending` / `failed` / `archived` |
| `last_synced_at` | timestamptz | |
| `last_modified_at` | timestamptz | Local file mtime |
| `error_message` | text | Last error, null if synced |
| `retry_count` | integer | Resets to 0 on success |
| `created_at` | timestamptz | First time this file was seen |
| `archived_at` | timestamptz | Set when file deleted locally |

### RLS Policies

- Users: read/write own rows only (`user_id = auth.uid()`)
- Admins (`is_admin = true`): read all rows, no write
- No public access

---

## Supabase Storage

### Bucket: `work-files`

- Private bucket
- No public URLs
- All access via signed URLs (1-hour expiry for admin downloads)

### RLS on Storage

- Users: can upload/read/delete only paths starting with their own `{userId}/`
- Admins: can read all paths (for download and export)
- No write access for admins (they should never modify employee files)
- No delete for anyone via client — archiving is done by moving to `_archive/` prefix, not deletion

### Storage Key Format

```
{userId}/{relative-path-from-work-folder-root}

Examples:
  abc-123/reports/Q1-2025.pdf
  abc-123/contracts/nda-client.docx
  abc-123/_archive/deleted-file.xlsx
```

---

## Storage Provider Abstraction

### Why This Exists

Supabase Storage is backed by AWS S3 internally. At ~20 employees storing documents, you will not exceed the 100GB included in the Pro plan for years. However, wrapping storage behind a provider interface costs ~30 minutes now and means any future migration is a config swap — not a rewrite.

### The Interface

`work-folder.ts` never calls Supabase Storage directly. It calls a `StorageProvider` interface with four methods:

| Method | Signature |
|--------|-----------|
| `upload` | `(key: string, blob: Blob, metadata?: object) → Promise<void>` |
| `archive` | `(key: string) → Promise<void>` — moves to `_archive/` prefix |
| `getSignedUrl` | `(key: string, expirySeconds: number) → Promise<string>` |
| `list` | `(prefix: string) → Promise<StorageObject[]>` |

### Providers

| Provider | When Used |
|----------|-----------|
| `SupabaseStorageProvider` | Default. Build this now. |
| `S3StorageProvider` | Future. Drop-in for AWS S3 or any S3-compatible service (Cloudflare R2, Backblaze B2, MinIO). |

### Configuration

One environment variable controls which provider is active:

```
STORAGE_PROVIDER=supabase   ← default
STORAGE_PROVIDER=s3         ← future swap
```

Provider is instantiated once at app startup and injected via the existing `ServicesContext`. No component ever knows which backend is running.

### Migration Path (When Needed)

1. Spin up target bucket (e.g. Cloudflare R2)
2. Run `rclone sync` from Supabase S3 → R2 — one command, handles all files
3. Update `work_folder_files.storage_key` if key format changes (likely it doesn't)
4. Set `STORAGE_PROVIDER=s3` in env, add S3 credentials, redeploy
5. Done — no code changes required

### Recommended Future Target: Cloudflare R2

- $0.015/GB/month vs Supabase's $0.021/GB
- **Zero egress fees** — critical since admin ZIP exports download everything
- S3-compatible API — `S3StorageProvider` implementation is identical to any other S3 client
- No reason to migrate until you actually need to — just keep the door open

### What Not To Do

- Do not build automated tiered migration (cold/warm/archive buckets) — unnecessary complexity at this scale
- Do not store provider-specific URLs in the database — store only the relative `storage_key`, resolve to full URL at runtime via the provider

---

## Files to Create / Modify

### New — Rust (`apps/desktop/src-tauri/src/`)

| File | Purpose |
|------|---------|
| `work_folder.rs` | Tauri commands: `setup_work_folder`, `start_watcher`, `stop_watcher`, `get_folder_path`, `check_path_is_sync_folder` |

### Modify — Rust

| File | Change |
|------|--------|
| `lib.rs` | Register `work_folder` module, add commands to invoke handler |
| `Cargo.toml` | Confirm `tauri-plugin-fs` is listed (verify — may already be present) |
| `capabilities/default.json` | Add `fs:allow-watch`, `fs:allow-read-file`, `fs:allow-create-dir` scoped to Desktop and Documents paths |

### New — Features Package (`packages/features/src/`)

| File | Purpose |
|------|---------|
| `services/work-folder.ts` | `uploadFile()`, `archiveFile()`, `listUserFiles()`, `getSignedUrl()`, `getStorageUsage()` — calls `StorageProvider` interface, never Supabase directly |
| `services/storage-providers/supabase-storage-provider.ts` | `SupabaseStorageProvider` — implements the 4-method interface against Supabase Storage |
| `services/storage-providers/storage-provider.interface.ts` | `StorageProvider` interface + `StorageObject` type definition |
| `hooks/use-work-folder.ts` | React Query: file list, sync status, storage used, retry mutation |

### New — Desktop App (`apps/desktop/src/`)

| File | Purpose |
|------|---------|
| `lib/work-folder-sync.ts` | Core sync engine: watcher listener, debounce map, checksum, queue management |
| `lib/work-folder-reconcile.ts` | Startup reconciliation pass: walk folder, diff against manifest, queue uploads |
| `stores/work-folder.ts` | Zustand store: queue state, per-file status map, tray icon state, watcher running flag |
| `components/WorkFolderSetup.tsx` | First-run setup modal |
| `components/WorkFolderSettings.tsx` | Settings tab: status, file list, retry controls |

### Modify — Desktop App

| File | Change |
|------|--------|
| `App.tsx` | On auth success: check `work-folder-configured`, trigger setup or reconcile+watch |
| `src/pages/Dashboard.tsx` or tray handler | Add Work Folder entries to tray menu |
| `src/pages/Settings.tsx` (if exists) | Add Work Folder tab |

### New — Web App (`apps/web/`)

| File | Purpose |
|------|---------|
| `app/admin/users/[userId]/work-folder/page.tsx` | Admin file browser for specific user |
| `app/api/admin/work-folder/export/route.ts` | ZIP export API route — streams from Supabase, pipes through archiver |

### Modify — Web App

| File | Change |
|------|--------|
| `app/admin/users/[userId]/page.tsx` | Add Work Folder tab link |

### New — Database

| File | Purpose |
|------|---------|
| `supabase/migrations/YYYYMMDD_work_folder.sql` | Creates `work_folder_configs`, `work_folder_files`, storage bucket, RLS policies |

---

## Build Order

Build in this exact sequence to avoid dependency issues:

1. **Database migration** — create tables, bucket, RLS policies. Test RLS manually before proceeding.
2. **`work-folder.ts` service** (features package) — upload, archive, list, signed URL. Test against real bucket.
3. **`work_folder.rs` Tauri commands** — folder creation, watcher start/stop. Test watcher emits correctly.
4. **Zustand store** — file status map, queue state, tray state.
5. **`work-folder-sync.ts`** — watcher listener, debounce, checksum, queue. Wire to service.
6. **`work-folder-reconcile.ts`** — startup walk, manifest diff, queue population.
7. **`WorkFolderSetup.tsx`** — first-run dialog. Wire to App.tsx.
8. **App.tsx integration** — auth success → setup check → reconcile → watch.
9. **Tray menu additions** — status label, open folder, view status.
10. **`WorkFolderSettings.tsx`** — settings tab, file list, retry.
11. **Admin web page** — file browser, download.
12. **ZIP export API route** — test with real files before shipping.

---

## Known Limitations

| Limitation | Impact | Resolution |
|------------|--------|------------|
| One machine per user assumed | If user logs in on a second machine, both watchers run simultaneously — last write wins, no conflict detection | Document clearly. If multi-device needed later, requires vector clock implementation. |
| No download / restore | Files lost locally cannot be restored via the app — admin must download from web panel | Acceptable for v1. Add restore UI in v2 if needed. |
| Folder rename cascade | Renaming a folder correctly updates all children — implementation must explicitly walk renamed directory | Must be handled in watcher event processing. |
| No bandwidth throttle | Concurrent uploads capped at 2 but no byte/s limit | Acceptable for office use. Add throttle if complaints arise. |
| ZIP export is synchronous | Large exports may timeout on the API route | Add streaming response headers. For very large exports (>500MB), move to background job. |
| Watcher heartbeat | `watcher_active` in DB requires desktop to update it periodically | Implement a 5-minute heartbeat update. Used only for admin visibility. |