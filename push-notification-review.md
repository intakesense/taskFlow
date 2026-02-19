# Push Notification Review — Final
**Date:** 2026-02-19  
**Reviewer:** Antigravity (Senior Dev Audit)  
**SDK Version:** OneSignal Web v16  
**Build:** ✅ Passing (zero TypeScript errors)

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 3 | ✅ All fixed |
| 🟡 Major | 6 | ✅ All fixed |
| 🟢 Minor | 3 | ✅ All fixed |
| � Senior Review | 6 | ✅ 4 fixed, 1 documented, 1 rejected |

---

## 🔴 Critical Issues

### C1 — Deprecated `include_external_user_ids`
**Files:** `notify/index.ts`, `notify-tasks/index.ts`  
**Fix:** Replaced with `include_aliases: { external_id: [...] }` per 2026 API spec.  
**Status:** ✅ Fixed

### C2 — `onesignal_player_id` column dependency
**Files:** `onesignal-init.tsx`, `notify/index.ts`  
**Fix:** Removed player ID writes/reads entirely. `OneSignal.login(userId)` links Supabase UID as `external_id`. OneSignal delivers to ALL devices per user.  
**Status:** ✅ Fixed

### C3 — Dead code: player IDs fetched but never used
**Files:** `notify-tasks/index.ts`  
**Fix:** Removed the dead DB query.  
**Status:** ✅ Fixed

---

## 🟡 Major Issues

### M1 — No `collapse_id` — notifications stack up
**Fix:** Set `collapse_id` = `conversation_id` (chat) / `task_id` (tasks). OS collapses rapid messages into one.  
**Status:** ✅ Fixed

### M2 — Missing `priority` and `ios_interruption_level`
**Fix:** Set `priority: 10` + `ios_interruption_level: "active"` on both edge functions.  
**Status:** ✅ Fixed

### M3 — Deep link URL points to wrong page
**Fix:** Chat → `/messages?conversation={id}`, Tasks → `/tasks/{id}`. Both `url` and `web_url` set.  
**Status:** ✅ Fixed

### M4 — Waterfall sequential DB queries
**Fix:** Parallelized with `Promise.all` in both functions. Task assignment is genuinely sequential (assigner ID lives inside task record).  
**Status:** ✅ Fixed

### M5 — Permission prompt fires too aggressively
**Fix:** Changed from `pageViews:1 + timeDelay:3` to `pageViews:3 + timeDelay:20`.  
**Status:** ✅ Fixed

### M6 — Missing `web_push_topic` + `chrome_web_badge`
**Fix:** Added to both chat and task notification payloads for Chrome grouping + Android badge.  
**Status:** ✅ Fixed

---

## 🟢 Minor Issues

### m1 — No subscription change listener
**Fix:** Added `PushSubscription.addEventListener('change')` + `Notifications.addEventListener('permissionChange')`. Both emit CustomEvents to sync the Settings page toggle in real-time.  
**Status:** ✅ Fixed

### m2 — No welcome notification
**Fix:** Added `welcomeNotification` in init config.  
**Status:** ✅ Fixed

### m3 — Race condition on `OneSignal.login()`
**Fix:** Added `callOneSignal()` helper that checks `window.OneSignal` existence before falling back to deferred queue.  
**Status:** ✅ Fixed

---

## 🔵 Senior Dev Review (Second Pass)

### S1 — `OneSignal.logout()` not called on sign-out
**Impact:** Notification leaks — next user on same browser gets previous user's notifications.  
**Fix:** Added `window.OneSignal.logout()` in `auth-context.tsx` before `supabase.auth.signOut()`.  
**Status:** ✅ Fixed

### S2 — iOS web push needs PNG icons (manifest had SVG only)
**Impact:** iOS 16.4+ silently refuses push subscription without PNG icons.  
**Fix:** Added 192/256/384/512px PNG entries in `manifest.ts`. Generated files via `sharp-cli`.  
**Status:** ✅ Fixed

### S3 — Settings toggle bypassed OneSignal (used raw browser API)
**Impact:** `Notification.requestPermission()` doesn't update OneSignal subscription state.  
**Fix:** Replaced with `PushSubscription.optIn()`/`optOut()` + try/catch for error resilience. Reads `optedIn` as source of truth.  
**Status:** ✅ Fixed

### S4 — `foregroundWillDisplay` suppressed ALL OS banners
**Impact:** If viewing Chat A and a message arrives for Chat B, the Chat B banner was suppressed too.  
**Fix:** Now only `preventDefault()` if the user is viewing the same conversation/task. Other notifications let the OS banner through while also showing an in-app toast with action button.  
**Status:** ✅ Fixed

### S5 — Self-notification on task status change
**Impact:** The person who changes a task's status receives their own notification.  
**Root cause:** Webhook payload doesn't include "who triggered the change" — no `updated_by` column.  
**Status:** ⚠️ Known limitation — requires schema change (`updated_by` column + trigger) to fix. Documented.

### S6 — App ID should be env var (over-engineering)
**Assessment:** OneSignal App ID is public, ships in the client bundle, is not a secret. Hardcoded is fine.  
**Status:** ❌ Rejected — kept hardcoded with env var override fallback.

---

## Files Changed
1. `supabase/functions/notify/index.ts` — C1, C2, M1, M2, M3, M4, M6
2. `supabase/functions/notify-tasks/index.ts` — C1, C3, M2, M6
3. `components/pwa/onesignal-init.tsx` — C2, M5, m1, m2, m3, S4
4. `lib/auth-context.tsx` — S1
5. `app/manifest.ts` — S2
6. `app/settings/page.tsx` — S3, m1
7. `public/icons/icon-*.png` — S2 (generated)

## Remaining Tech Debt (non-blocking)
- `onesignal_player_id` column still exists in DB schema — no code uses it, drop via migration when convenient
- Self-notification on task status change (S5) — needs `updated_by` column to fix properly
