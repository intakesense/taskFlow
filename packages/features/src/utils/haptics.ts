/**
 * Haptic Feedback Utilities
 *
 * Provides tactile feedback on mobile devices when users interact with the app.
 * Falls back gracefully on devices/browsers that don't support vibration.
 */

export const haptics = {
  /**
   * Light tap - for UI selections, toggles, switches
   * ~10ms vibration
   */
  light: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  },

  /**
   * Medium tap - for button presses, sending messages
   * ~25ms vibration
   */
  medium: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
  },

  /**
   * Heavy tap - for destructive actions, confirmations
   * ~40ms vibration
   */
  heavy: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(40);
    }
  },

  /**
   * Success pattern - for completed actions
   * Short-pause-short pattern
   */
  success: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([10, 50, 10]);
    }
  },

  /**
   * Error pattern - for failed actions
   * Triple buzz pattern
   */
  error: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([50, 30, 50, 30, 50]);
    }
  },

  /**
   * Selection change - very subtle for list item selection
   * ~5ms vibration
   */
  selection: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(5);
    }
  },

  /**
   * Notification - for incoming message/notification
   * Double pulse pattern
   */
  notification: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([15, 100, 15]);
    }
  },
};

/**
 * Hook for using haptics with automatic mobile detection
 */
export function useHaptics() {
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  return {
    ...haptics,
    isSupported,
  };
}
