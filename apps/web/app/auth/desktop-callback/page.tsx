'use client';

import { useEffect, useRef, useState } from 'react';

export default function DesktopCallbackPage() {
  const [status, setStatus] = useState<'redirecting' | 'success' | 'error'>('redirecting');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(5);
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      setErrorMessage('No authentication code received from the provider.');
      setStatus('error');
      return;
    }

    // Forward the PKCE code to the desktop app via deep link.
    // The desktop Supabase client holds the matching code_verifier in its
    // localStorage and is the only party that can exchange this code.
    //
    // We use a hidden <a> click (rel="opener") rather than window.location.href
    // so the browser does not navigate away from this page — custom-scheme
    // redirects leave the tab open on a blank/error page otherwise.
    const deepLink = `taskflow://auth/callback?${params.toString()}`;
    const anchor = document.createElement('a');
    anchor.href = deepLink;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    setStatus('success');
  }, []);

  // Auto-close countdown once the deep link has been dispatched
  useEffect(() => {
    if (status !== 'success') return;

    // Attempt programmatic close first (works when the tab was opened by the app)
    window.close();

    // Start a countdown in case window.close() was blocked
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          window.close(); // final attempt
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  const containerStyle: React.CSSProperties = {
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
  };

  const iconStyle = (color: string): React.CSSProperties => ({
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.5rem',
    fontSize: 32,
  });

  if (status === 'error') {
    return (
      <div style={containerStyle}>
        <div style={iconStyle('linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)')}>✕</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
          Sign-In Failed
        </h1>
        <p style={{ color: '#888', margin: '0 0 2rem', fontSize: '0.95rem' }}>
          {errorMessage}
        </p>
        <p style={{ color: '#555', fontSize: '0.85rem' }}>
          Close this tab and try again from the desktop app.
        </p>
      </div>
    );
  }

  if (status === 'redirecting') {
    return (
      <div style={containerStyle}>
        <div style={iconStyle('linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)')}>…</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
          Completing Sign-In
        </h1>
        <p style={{ color: '#888', margin: 0, fontSize: '0.95rem' }}>
          Opening TaskFlow…
        </p>
      </div>
    );
  }

  // status === 'success'
  return (
    <div style={containerStyle}>
      <div style={iconStyle('linear-gradient(135deg, #22c55e 0%, #16a34a 100%)')}>✓</div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
        Signed In Successfully
      </h1>
      <p style={{ color: '#888', margin: '0 0 1rem', fontSize: '0.95rem' }}>
        You&apos;re now signed in to TaskFlow.
      </p>
      <p style={{ color: '#555', fontSize: '0.85rem' }}>
        {countdown > 0
          ? `This tab will close in ${countdown}s — or close it manually.`
          : 'You can close this tab.'}
      </p>
    </div>
  );
}
