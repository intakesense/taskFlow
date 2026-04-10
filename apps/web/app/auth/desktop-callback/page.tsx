'use client';

import { useEffect } from 'react';

export default function DesktopCallbackPage() {
  useEffect(() => {
    // Forward the token hash to the Tauri deep link scheme so the desktop
    // app can pick it up, while this page stays visible in the browser.
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      window.location.href = 'taskflow://auth/callback' + hash;
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#0a0a0a',
      color: '#fff',
      textAlign: 'center',
      padding: '2rem',
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.5rem',
        fontSize: 32,
      }}>
        ✓
      </div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
        Login Successful
      </h1>
      <p style={{ color: '#888', margin: '0 0 2rem', fontSize: '0.95rem' }}>
        You&apos;re signed in to TaskFlow. You can close this tab and return to the app.
      </p>
      <button
        onClick={() => window.close()}
        style={{
          padding: '0.6rem 1.5rem',
          borderRadius: 8,
          border: '1px solid #333',
          background: '#1a1a1a',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '0.9rem',
        }}
      >
        Close Tab
      </button>
    </div>
  );
}
