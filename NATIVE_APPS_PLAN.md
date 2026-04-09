# TaskFlow Native Apps Implementation Plan

> **Status:** Phase 1 Complete (Monorepo Setup)
> **Last Updated:** March 18, 2026

## Overview

This document outlines the complete implementation plan for adding native mobile (iOS/Android) and desktop (Windows/macOS/Linux) apps to TaskFlow, enabling true background push notifications that bypass PWA limitations.

---

## Architecture

```
taskflow/
├── apps/
│   ├── web/                    # Next.js 16 (existing, moved)
│   ├── mobile/                 # Expo SDK 55 (iOS + Android)
│   └── desktop/                # Tauri 2.0 (Windows/macOS/Linux)
├── packages/
│   ├── core/                   # Shared types, schemas, constants
│   ├── ui/                     # Shared shadcn components, animations
│   ├── features/               # Shared feature components, hooks, services
│   └── supabase-client/        # Platform-agnostic Supabase factory
├── supabase/                   # Edge functions, migrations
├── turbo.json                  # Build orchestration
└── pnpm-workspace.yaml         # Workspace config
```

### Package Roles

| Package | Contents | Used By |
|---------|----------|---------|
| `@taskflow/core` | Types, schemas, constants, theme utilities | All apps |
| `@taskflow/ui` | shadcn components, animations, Sonner | All apps |
| `@taskflow/features` | Feature components (Tasks, Settings), hooks, services | Web, Desktop |
| `@taskflow/supabase-client` | Supabase client factory | All apps |

---

## Technology Stack

| Platform | Framework | Push Notifications | Auth | Version |
|----------|-----------|-------------------|------|---------|
| Web | Next.js 16 | FCM Web Push | Supabase Auth (cookies) | React 19.2 |
| iOS | Expo SDK 55 | FCM (wraps APNs) | Supabase Auth (secure-store) | RN 0.83 |
| Android | Expo SDK 55 | FCM | Supabase Auth (secure-store) | RN 0.83 |
| Desktop | Tauri 2.0 | Supabase Realtime | Supabase Auth (tauri-store) | Rust + React |

### Authentication Strategy

**Single auth system (Supabase Auth)** across all platforms:
- Same user accounts, same credentials
- Platform-specific secure token storage
- OAuth (Google) works on all platforms
- No Firebase Auth needed - only FCM for push notifications

### Why FCM Everywhere (Not OneSignal)

- **Single integration** - One SDK, one dashboard, one codebase
- **Free unlimited** - No message limits unlike OneSignal
- **Lower latency** - Direct delivery, no middleman
- **Full control** - Your Firebase project, your data
- **Native support** - FCM handles APNs wrapping for iOS automatically

---

## Phase 1: Monorepo Setup ✅ COMPLETE

### Completed Tasks
- [x] Created pnpm workspace with Turborepo
- [x] Moved Next.js app to `apps/web/`
- [x] Created `@taskflow/core` package (types, schemas, utils)
- [x] Created `@taskflow/supabase-client` package
- [x] Initialized Expo SDK 55 mobile app
- [x] Initialized Tauri 2.0 desktop app
- [x] Created `device_tokens` migration

### Commands Available
```bash
pnpm dev:web        # Run web app
pnpm dev:mobile     # Run mobile app (Expo)
pnpm dev:desktop    # Run desktop app (requires Rust)
pnpm build          # Build all apps
pnpm db:push        # Push migrations
pnpm db:types       # Generate TypeScript types
```

---

## Phase 2: Firebase Setup (1 day)

> **Note:** Firebase is ONLY for push notifications (FCM). Authentication uses Supabase Auth (already set up).

### 2.1 Create Firebase Project (ONE project for all platforms)
- [ ] Go to [Firebase Console](https://console.firebase.google.com)
- [ ] Create new project "TaskFlow"
- [ ] Add Android app → download `google-services.json`
- [ ] Add Web app → copy config object
- [ ] (Later) Add iOS app → download `GoogleService-Info.plist`
- [ ] Enable Cloud Messaging in Project Settings

### 2.2 Configure Web Push
- [ ] Generate VAPID keys in Firebase Console
- [ ] Add to Supabase Edge Function secrets:
  ```bash
  supabase secrets set FIREBASE_PROJECT_ID=xxx
  supabase secrets set FIREBASE_PRIVATE_KEY=xxx
  supabase secrets set FIREBASE_CLIENT_EMAIL=xxx
  ```

### 2.3 Configure EAS (Expo Application Services)
- [ ] Run `eas init` in `apps/mobile/`
- [ ] Configure `eas.json` with FCM credentials
- [ ] Set up iOS push certificate in Apple Developer Portal

---

## Phase 3: Push Notification Infrastructure (1 week)

### 3.1 Database Migration
Already created: `supabase/migrations/20260318000000_device_tokens.sql`

```sql
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'desktop')),
    device_name TEXT,
    app_version TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_used_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, token)
);
```

### 3.2 Unified FCM Edge Function
Create `supabase/functions/notify-fcm/index.ts`:

```typescript
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert({
    projectId: Deno.env.get('FIREBASE_PROJECT_ID'),
    privateKey: Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
    clientEmail: Deno.env.get('FIREBASE_CLIENT_EMAIL'),
  }),
});

interface NotificationPayload {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  deepLink?: string;
}

Deno.serve(async (req) => {
  const payload: NotificationPayload = await req.json();

  // Fetch device tokens for all target users
  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('token, platform')
    .in('user_id', payload.userIds);

  if (!tokens?.length) return new Response('No tokens', { status: 200 });

  // Send via FCM (handles iOS, Android, and Web)
  const messaging = getMessaging(app);
  const response = await messaging.sendEachForMulticast({
    tokens: tokens.map(t => t.token),
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      deepLink: payload.deepLink || '',
      ...payload.data,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'messages',
        icon: 'ic_notification',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
    webpush: {
      fcmOptions: {
        link: payload.deepLink,
      },
    },
  });

  return new Response(JSON.stringify(response), { status: 200 });
});
```

### 3.3 Database Triggers
Update existing notify triggers to call the new FCM function instead of OneSignal.

---

## Phase 4: Mobile App Development (3 weeks)

### 4.1 Auth Flow (Week 1)
- [ ] Create auth store with Zustand + expo-secure-store
- [ ] Implement login screen with email/password
- [ ] Implement Google OAuth (expo-auth-session)
- [ ] Add biometric authentication (optional)
- [ ] Token refresh handling

### 4.2 Push Notification Setup
```typescript
// apps/mobile/src/lib/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from './supabase';

export async function registerForPushNotifications(userId: string) {
  if (!Device.isDevice) return;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const token = await Notifications.getDevicePushTokenAsync();

  await supabase.from('device_tokens').upsert({
    user_id: userId,
    token: token.data,
    platform: Platform.OS, // 'ios' or 'android'
    device_name: Device.modelName,
  });
}
```

### 4.3 Core Screens (Week 2-3)

#### Messages Tab
- [ ] `app/(main)/(tabs)/messages/index.tsx` - Conversation list
- [ ] `app/(main)/(tabs)/messages/[id].tsx` - Chat screen
- [ ] Real-time message subscription
- [ ] Typing indicators
- [ ] Message reactions
- [ ] File attachments (images, documents)

#### Tasks Tab
- [ ] `app/(main)/(tabs)/tasks/index.tsx` - Task list with filters
- [ ] `app/(main)/(tabs)/tasks/[id].tsx` - Task detail
- [ ] Progress updates timeline
- [ ] Task creation drawer
- [ ] Kanban view (optional)

#### Settings Tab
- [ ] Profile management
- [ ] Notification preferences
- [ ] Theme settings
- [ ] Logout

### 4.4 Deep Linking
```typescript
// apps/mobile/app/_layout.tsx
export const unstable_settings = {
  initialRouteName: '(main)',
};

// Handle notification tap
Notifications.addNotificationResponseReceivedListener((response) => {
  const { deepLink } = response.notification.request.content.data;
  if (deepLink) router.push(deepLink);
});
```

---

## Phase 5: Desktop App Development (2 weeks)

### 5.1 Prerequisites
- [ ] Install Rust: https://rustup.rs
- [ ] Install platform-specific dependencies:
  - Windows: Visual Studio Build Tools
  - macOS: Xcode Command Line Tools
  - Linux: `webkit2gtk`, `libappindicator`

### 5.2 Rust Backend Setup
Add notification plugin to `apps/desktop/src-tauri/Cargo.toml`:
```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-notification = "2"
tauri-plugin-autostart = "2"
tauri-plugin-store = "2"
tauri-plugin-updater = "2"
```

### 5.3 System Tray
```rust
// apps/desktop/src-tauri/src/main.rs
use tauri::{Manager, SystemTray, SystemTrayMenu, SystemTrayMenuItem};

fn main() {
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("show", "Open TaskFlow"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("quit", "Quit"));

    tauri::Builder::default()
        .system_tray(SystemTray::new().with_menu(tray_menu))
        .on_system_tray_event(|app, event| {
            // Handle tray events
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 5.4 Realtime Notifications ✅ COMPLETE
Desktop uses Supabase Realtime instead of FCM for native notifications:

**Implementation (`apps/desktop/src/lib/desktop-notifications.ts`):**
- `DesktopNotificationManager` class subscribes to Supabase realtime channels
- Listens to: messages, task_messages, task_assignees, tasks (status changes)
- WhatsApp-style notification sound via Web Audio API
- Click-to-navigate via `@tauri-apps/plugin-notification` onAction handler
- Respects user preferences (granular per-type toggles)
- Only shows notifications when app is not focused

**Notification Types:**
- Messages: New DMs and group messages
- Task assignments: When assigned to a task
- Progress updates: Task progress and comments
- Mentions: When @mentioned in a message
- Task status: When task status changes

**Settings UI (`apps/desktop/src/components/settings/desktop-notifications.tsx`):**
- Master toggle for all notifications
- Sound on/off toggle
- Per-type notification toggles (messages, tasks, progress, mentions)
- Test notification button
- Start on login toggle

### 5.5 Core Screens (Using @taskflow/features)
Desktop app now uses shared components from `@taskflow/features`:

- [x] Login screen (using `LoginView` from @taskflow/features)
- [x] Tasks view (using `TasksContainer` from @taskflow/features)
- [x] Task detail view (using `TaskDetailContainer` from @taskflow/features)
- [x] Settings (using `SettingsView`, `AppearanceSettings` from @taskflow/features)
- [x] Messages view (using `MessagesContainer` from @taskflow/features)
- [x] Native desktop notifications (WhatsApp-style)
- [ ] Auto-updater integration

**Shared Component Usage:**
```typescript
// apps/desktop/src/pages/Login.tsx
import { LoginView } from '@taskflow/features';

// apps/desktop/src/pages/Dashboard.tsx
import {
  DashboardLayout,
  TasksContainer,
  TaskDetailContainer,
  CreateTaskDrawer,
  ProgressFeedSheet,
  SettingsView,
} from '@taskflow/features';
```

---

## Phase 6: Web FCM Migration (1 week)

### 6.1 Replace OneSignal with FCM
- [ ] Remove OneSignal SDK from web app
- [ ] Add Firebase SDK
- [ ] Create service worker for FCM
- [ ] Update notification permissions flow

### 6.2 Service Worker
```javascript
// apps/web/public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '...',
  projectId: '...',
  messagingSenderId: '...',
  appId: '...',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icon-192x192.png',
    data: payload.data,
  });
});
```

---

## Phase 7: Testing & QA (1 week)

### 7.1 Test Matrix

| Test Case | Web | iOS | Android | Desktop |
|-----------|-----|-----|---------|---------|
| Login/Logout | | | | |
| Push notification (foreground) | | | | |
| Push notification (background) | | | | |
| Push notification (app killed) | | | | |
| Deep link from notification | | | | |
| Message send/receive | | | | |
| Real-time sync | | | | |
| Offline → Online sync | | | | |
| File upload | | | | |

### 7.2 Platform-Specific Testing
- [ ] iOS: Test on physical device (simulator doesn't support push)
- [ ] Android: Test on physical device and emulator
- [ ] Desktop: Test on Windows, macOS, Linux
- [ ] Web: Test on Chrome, Firefox, Safari, Edge

---

## Phase 8: Release (1 week)

### 8.1 Mobile App Stores
- [ ] Create App Store Connect listing (iOS)
- [ ] Create Google Play Console listing (Android)
- [ ] Prepare screenshots and descriptions
- [ ] Submit for review

### 8.2 Desktop Distribution
- [ ] Set up GitHub Releases for auto-updater
- [ ] Code signing:
  - Windows: EV Code Signing Certificate
  - macOS: Apple Developer ID
- [ ] Create installers:
  - Windows: `.msi` or `.exe`
  - macOS: `.dmg`
  - Linux: `.AppImage`, `.deb`

### 8.3 Web Migration
- [ ] Deploy FCM-enabled web app
- [ ] Monitor for regressions
- [ ] Remove OneSignal account

---

## Timeline Summary

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 1. Monorepo Setup | ✅ Done | - |
| 2. Firebase Setup | 1 day | - |
| 3. Push Infrastructure | 1 week | Phase 2 |
| 4. Mobile Development | 3 weeks | Phase 3 |
| 5. Desktop Development | 2 weeks | Phase 2 |
| 6. Web FCM Migration | 1 week | Phase 3 |
| 7. Testing | 1 week | Phase 4, 5, 6 |
| 8. Release | 1 week | Phase 7 |

**Total: ~10 weeks**

---

## Prerequisites Checklist

Before starting development:

- [ ] **Rust** - Install from https://rustup.rs (for Tauri desktop)
- [ ] **Firebase Project** - Create at https://console.firebase.google.com
- [ ] **Apple Developer Account** - $99/year for iOS distribution
- [ ] **Google Play Developer Account** - $25 one-time for Android
- [ ] **EAS Account** - For Expo cloud builds
- [ ] **Code Signing Certificates** - For desktop distribution

---

## Environment Variables

### Root `.env`
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Firebase (for Edge Functions)
FIREBASE_PROJECT_ID=xxx
FIREBASE_PRIVATE_KEY=xxx
FIREBASE_CLIENT_EMAIL=xxx
```

### Mobile `apps/mobile/.env`
```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
```

### Desktop `apps/desktop/.env`
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

---

## Useful Commands

```bash
# Development
pnpm dev:web              # Start web dev server
pnpm dev:mobile           # Start Expo dev server
pnpm dev:desktop          # Start Tauri dev (requires Rust)

# Building
pnpm build:web            # Build web for production
pnpm build:mobile         # Build mobile (use EAS instead)
pnpm build:desktop        # Build desktop app

# Database
pnpm db:push              # Push migrations to Supabase
pnpm db:types             # Generate TypeScript types
pnpm db:status            # Check migration status

# Mobile (run from apps/mobile/)
npx eas build --platform ios --profile preview
npx eas build --platform android --profile preview
npx eas submit --platform ios
npx eas submit --platform android

# Desktop (run from apps/desktop/)
pnpm tauri build          # Build for current platform
pnpm tauri build --target x86_64-pc-windows-msvc
pnpm tauri build --target aarch64-apple-darwin
```

---

## Resources

- [Expo SDK 55 Docs](https://docs.expo.dev/)
- [Tauri 2.0 Docs](https://v2.tauri.app/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [EAS Build](https://docs.expo.dev/build/introduction/)
