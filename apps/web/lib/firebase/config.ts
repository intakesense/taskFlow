import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyAXSE0D1Pa2UV34lmz6V7aCxX8_WD3IMwc",
  authDomain: "taskflow-98484.firebaseapp.com",
  projectId: "taskflow-98484",
  storageBucket: "taskflow-98484.firebasestorage.app",
  messagingSenderId: "816380669467",
  appId: "1:816380669467:web:934516e878c748185292be",
  measurementId: "G-BV09YZXSH2"
};

// Initialize Firebase (only once)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Get messaging instance (only in browser)
let messaging: Messaging | null = null;

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;

  if (!messaging) {
    messaging = getMessaging(app);
  }
  return messaging;
}

export { app, getToken, onMessage };
