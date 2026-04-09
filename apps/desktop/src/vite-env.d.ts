/// <reference types="vite/client" />

// Tauri globals
interface Window {
  __TAURI_INTERNALS__?: unknown;
}
