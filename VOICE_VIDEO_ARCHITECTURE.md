# Voice & Video Architecture Decision

## Overview

This document outlines the technical decisions for implementing voice/video chat (ChitChat) across TaskFlow's web and desktop (Tauri) applications.

## Current State

- **Web app**: Uses Daily.co for voice/video (implemented but deleted during monorepo migration)
- **Desktop app**: No voice/video implementation yet
- **Team size**: ~20 employees (small, internal team)

---

## Platform Analysis

### Web (Next.js)

| Capability | Support | Notes |
|------------|---------|-------|
| WebRTC | Native | Full browser support |
| Audio/Video | Full | getUserMedia, echo cancellation built-in |
| Screen Share | Full | getDisplayMedia works seamlessly |
| Background Audio | Yes | May throttle after 5-6 min if tab hidden |

### Desktop (Tauri + WebView2 on Windows)

| Capability | Support | Notes |
|------------|---------|-------|
| WebRTC | Full | WebView2 is Chromium-based |
| Audio/Video | Full | Inherits Chrome's WebRTC stack |
| Screen Share | Partial | getDisplayMedia works but UI dialog may crop |
| Background Audio | Configurable | Needs throttling policy configuration |
| Native Audio | Possible | Via Tauri plugins (cpal, tauri-plugin-audio-recorder) |

### Platform-Specific Limitations

| Platform | Limitation |
|----------|------------|
| Windows (WebView2) | Screen share dialog UI issues when WebView not fullscreen |
| macOS (WKWebView) | getDisplayMedia NOT supported (no screen share) |
| Linux (WebKitGTK) | WebRTC NOT supported without experimental builds |

---

## Solution Options

### Option A: Managed WebRTC Service (Recommended)

Use a third-party service that handles all WebRTC infrastructure.

**Services Compared:**

| Service | Free Tier | Pricing | Integration | Best For |
|---------|-----------|---------|-------------|----------|
| Daily.co | 2,000 min/mo | $0.004/min | Iframe/SDK | Quick launch, simplicity |
| 100ms | Available | ~$0.004/min | SDK + prebuilt UI | Developer experience |
| LiveKit | 5,000 min/mo | $0.004-0.024/min | SDK | Open-source, self-host option |
| Agora | 10,000 min/mo | Higher | SDK | Enterprise scale |
| Twilio | Pay-per-use | $0.0015-0.004/min | SDK | Legacy, more expensive |

**Cost Estimate for TaskFlow (20 users, ~10 hours/month):**
- Daily.co: Free tier likely sufficient (~$0-5/month)
- 100ms: ~$0-5/month
- LiveKit: ~$0-5/month

**Recommendation: Daily.co**

Reasons:
1. Already integrated in the web app codebase
2. Simplest integration (iframe-based option available)
3. Free tier covers small team usage
4. Handles STUN/TURN/SFU infrastructure
5. Works in Tauri WebView2 on Windows
6. Published Electron integration tutorials (applies to Tauri)

### Option B: Self-Hosted Open Source

Run your own WebRTC infrastructure.

**Options:**
- **Jitsi Meet**: Full-featured, Java-based, requires server
- **LiveKit (self-hosted)**: Go-based, modern, requires server
- **mediasoup**: Node.js SFU, requires server

**Why NOT recommended for TaskFlow:**
- Requires dedicated server infrastructure
- Operational overhead (maintenance, scaling, monitoring)
- Overkill for 20 users
- TURN server costs can exceed managed service pricing

### Option C: Pure Peer-to-Peer

Direct WebRTC connections without media server.

**Limitations:**
- Only works on same local network (LAN/WiFi)
- Requires STUN server for internet (can use free Google STUN)
- Requires TURN server for NAT traversal (not free)
- Doesn't scale beyond 4-5 participants
- No recording capability

**Why NOT recommended:**
- Team likely not on same network
- Still needs TURN infrastructure for reliability
- Poor quality with multiple participants

---

## Architecture Decision

### Chosen Approach: Daily.co (Option A)

```
┌─────────────────────────────────────────────────────────────────┐
│                         TaskFlow Apps                           │
├─────────────────────────────┬───────────────────────────────────┤
│      Web (Next.js)          │      Desktop (Tauri)              │
│                             │                                   │
│  ┌───────────────────────┐  │  ┌─────────────────────────────┐  │
│  │  @taskflow/features   │  │  │    @taskflow/features       │  │
│  │  - VoiceChannelProvider│  │  │    - VoiceChannelProvider   │  │
│  │  - ChitChatContainer  │  │  │    - ChitChatContainer      │  │
│  │  - VoiceChannelPanel  │  │  │    - VoiceChannelPanel      │  │
│  └───────────┬───────────┘  │  └─────────────┬───────────────┘  │
│              │              │                │                   │
│  ┌───────────▼───────────┐  │  ┌─────────────▼───────────────┐  │
│  │   Daily.co SDK        │  │  │     Daily.co SDK            │  │
│  │   @daily-co/daily-js  │  │  │     @daily-co/daily-js      │  │
│  │   @daily-co/daily-react│ │  │     @daily-co/daily-react   │  │
│  └───────────┬───────────┘  │  └─────────────┬───────────────┘  │
│              │              │                │                   │
└──────────────┼──────────────┴────────────────┼───────────────────┘
               │                               │
               ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Daily.co Cloud                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ STUN/TURN   │  │ SFU Media   │  │ Room Management         │  │
│  │ Servers     │  │ Servers     │  │ (create, join, leave)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase Backend                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ voice_channels          │ voice_channel_participants        ││
│  │ - id                    │ - channel_id                      ││
│  │ - name                  │ - user_id                         ││
│  │ - daily_room_name       │ - joined_at                       ││
│  │ - is_default            │ - is_muted                        ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### API Routes Required

```
/api/daily/room     - Create/get Daily room for a channel
/api/daily/token    - Generate meeting token for user
/api/voice/leave    - Cleanup on disconnect (beacon API)
```

### Code Sharing Strategy

All voice/video code lives in `@taskflow/features`:

```
packages/features/src/
├── components/voice/
│   ├── index.ts
│   ├── chitchat-container.tsx    # Main entry point
│   ├── voice-channel-panel.tsx   # Active call UI
│   ├── voice-controls.tsx        # Mute, video, screen share buttons
│   ├── participant-grid.tsx      # Video grid layout
│   ├── participant-tile.tsx      # Individual participant
│   ├── device-settings-dialog.tsx
│   └── idle-warning-dialog.tsx
├── providers/
│   └── voice-channel-context.tsx # Daily.co state management
├── hooks/
│   └── use-voice-participants.ts # Real-time participant list
└── services/
    └── voice-channels.ts         # Supabase operations
```

---

## Desktop-Specific Considerations

### Windows (Primary Target)

WebView2 provides full WebRTC support. No special handling needed except:

1. **Background Audio Throttling**
   ```rust
   // In Tauri config or runtime
   // Prevent audio cutoff when app minimized
   webview.set_background_color(Color::Transparent)?;
   // Configure appropriate throttling policy
   ```

2. **Screen Share Dialog**
   - getDisplayMedia works but dialog may crop
   - Consider adding native screen capture via Tauri plugin as enhancement

### macOS (Secondary)

- Audio/video works via WKWebView
- Screen sharing NOT supported (getDisplayMedia unavailable)
- Options:
  - Disable screen share button on macOS
  - Add native screen capture via Tauri plugin (future enhancement)

### Linux (Low Priority)

- WebRTC not supported in WebKitGTK
- Options:
  - Show "voice chat not available on Linux" message
  - Build custom WebKitGTK with WebRTC flags (complex)

---

## Implementation Plan

### Phase 1: Core Migration (Current Sprint)

1. Add Daily.co dependencies to `@taskflow/features`
2. Migrate voice components from old web app
3. Create voice channel service with Supabase
4. Add ChitChat route to desktop app
5. Test on Windows

### Phase 2: Polish

1. Handle macOS screen share limitation (disable button)
2. Handle Linux gracefully (show message)
3. Configure background throttling for Tauri
4. Add device selection dialog

### Phase 3: Enhancements (Future)

1. Native screen capture for desktop (better UX)
2. Push-to-talk keyboard shortcut
3. Noise suppression toggle
4. Virtual background (if Daily supports)

---

## Cost Analysis

### Daily.co Pricing (as of 2025)

| Tier | Included | Overage |
|------|----------|---------|
| Free | 2,000 participant-min/mo | N/A |
| Scale | Pay-as-you-go | $0.004/participant-min |

### TaskFlow Usage Estimate

- 20 employees
- Average 30 min voice/day per user
- 20 working days/month
- = 20 × 30 × 20 = 12,000 participant-minutes/month

**Estimated Cost: ~$40-50/month** after free tier

### Comparison with Self-Hosting

| Item | Managed (Daily) | Self-Hosted |
|------|-----------------|-------------|
| Monthly Cost | ~$50 | $50-200+ (server) |
| Setup Time | Hours | Days-weeks |
| Maintenance | None | Ongoing |
| Scaling | Automatic | Manual |
| Reliability | 99.99% SLA | Your responsibility |

**Verdict**: Managed service is more cost-effective for small teams.

---

## Security Considerations

1. **Daily.co Security**
   - SOC 2 Type II certified
   - HIPAA compliant option available
   - End-to-end encryption available

2. **Token Security**
   - Meeting tokens generated server-side
   - Tokens are short-lived (default 1 hour)
   - User ID embedded in token for accountability

3. **Supabase RLS**
   - voice_channels: Admin-only create/update
   - voice_channel_participants: Users can only modify own record

---

## Alternatives Considered

### Why Not LiveKit?

- More complex setup (even managed)
- Requires separate token server logic
- No iframe option for quick integration
- Better for: teams wanting self-host option later

### Why Not Agora?

- Higher pricing for small teams
- More enterprise-focused
- Overkill for internal team app

### Why Not Jitsi?

- Requires server infrastructure
- Operational overhead
- Better for: organizations with DevOps resources

### Why Not Native Rust WebRTC?

- webrtc-rs still evolving
- Massive implementation effort
- Different codebase for web vs desktop
- Better for: performance-critical apps with dedicated team

---

## References

- [Daily.co Documentation](https://docs.daily.co/)
- [Daily.co + Electron Tutorial](https://www.daily.co/blog/building-a-video-call-overlay-app-with-electron-and-daily-part-1/)
- [Tauri WebView Capabilities](https://v2.tauri.app/reference/webview-versions/)
- [WebRTC in WebView2](https://docs.microsoft.com/en-us/microsoft-edge/webview2/)
- [Discord Voice Architecture](https://discord.com/blog/how-discord-handles-two-and-half-million-concurrent-voice-users-using-webrtc)

---

## Decision Summary

| Question | Answer |
|----------|--------|
| Which service? | Daily.co (already integrated) |
| Self-host? | No (not cost-effective for 20 users) |
| Same code for web/desktop? | Yes (via @taskflow/features) |
| Desktop limitations? | macOS: no screen share, Linux: no WebRTC |
| Estimated cost? | ~$50/month for full team usage |
| Implementation effort? | ~1-2 days (migration from existing code) |
