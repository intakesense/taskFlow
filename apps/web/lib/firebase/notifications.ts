import { getFirebaseMessaging, getToken, onMessage } from './config';
import { createClient } from '@/lib/supabase/client';

// VAPID key - generate this in Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
// For now, we'll use a placeholder - you need to generate this
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  // FCM Web Push requires HTTPS - skip on localhost
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.log('[FCM] Skipping registration on localhost (HTTPS required)');
    return null;
  }

  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.warn('[FCM] Firebase Messaging not available');
    return null;
  }

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    console.warn('[FCM] Notification permission denied');
    return null;
  }

  try {
    if (!VAPID_KEY) {
      console.error('[FCM] VAPID key is missing');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
    });

    if (token) {
      const supabase = createClient();
      await supabase.from('device_tokens').upsert({
        user_id: userId,
        token,
        platform: 'web',
        device_name: navigator.userAgent.includes('Mobile') ? 'Mobile Web' : 'Desktop Web',
      }, {
        onConflict: 'user_id,token',
      });

      console.log('[FCM] Token registered');
      return token;
    }

    return null;
  } catch (error) {
    console.error('[FCM] Registration error:', error);
    return null;
  }
}

export async function unregisterFromPushNotifications(userId: string): Promise<void> {
  const messaging = getFirebaseMessaging();
  if (!messaging) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (registration) {
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        const supabase = createClient();
        await supabase
          .from('device_tokens')
          .delete()
          .eq('user_id', userId)
          .eq('token', token);
      }
    }
  } catch (error) {
    console.error('Error unregistering from push notifications:', error);
  }
}

export function onForegroundMessage(callback: (payload: { title?: string; body?: string; data?: Record<string, string> }) => void): () => void {
  const messaging = getFirebaseMessaging();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    callback({
      title: payload.notification?.title,
      body: payload.notification?.body,
      data: payload.data as Record<string, string>,
    });
  });
}
