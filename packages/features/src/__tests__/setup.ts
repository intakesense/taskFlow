import { vi } from 'vitest'
import '@testing-library/react'

// Silence sonner toasts in tests
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  },
}))

// Silence haptics (navigator.vibrate not in jsdom)
vi.mock('../utils/haptics', () => ({
  haptics: {
    light: vi.fn(),
    medium: vi.fn(),
    heavy: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Silence calendar sync — it's a fire-and-forget side effect, not under test here
vi.mock('../services/calendar-sync', () => ({
  syncTaskToCalendar: vi.fn().mockResolvedValue(undefined),
  removeTaskFromCalendar: vi.fn().mockResolvedValue(undefined),
}))
