# Future Fixes

## BottomNavProvider Architecture Refactor

**Issue:** `DashboardLayout` creates its own `BottomNavProvider`, so multiple layouts = multiple isolated contexts. This causes state fragmentation and unnecessary re-renders.

**Current workaround:** Hide logic placed inside child components (e.g., `VoiceChannelPanel`) that render within the same `DashboardLayout` instance.

**Proper fix:**
1. Move `BottomNavProvider` to `app/layout.tsx` (single root provider)
2. Remove provider from `DashboardLayout`, keep only consumer logic
3. `DashboardLayout` uses `useBottomNavVisibility()` directly

**Files involved:**
- `app/layout.tsx`
- `components/layout/dashboard-layout.tsx`
- `components/layout/bottom-nav-context.tsx`
