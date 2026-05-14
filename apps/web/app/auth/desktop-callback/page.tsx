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

    // PKCE flow: Supabase delivers the authorization code as ?code= query param.
    // Implicit flow fallback: token arrives in the URL hash as #access_token=...
    // We handle both and forward to the desktop app via deep link.
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');

    if (code) {
      // PKCE flow — forward the code so desktop can call exchangeCodeForSession(code)
      const deepLink = `taskflow://auth/callback?code=${encodeURIComponent(code)}`;
      fireDeepLink(deepLink);
      setStatus('success');
      return;
    }

    // Implicit flow fallback — token arrives in the URL hash fragment
    const hash = window.location.hash.slice(1); // strip leading '#'
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const expiresAt = hashParams.get('expires_at');
      const tokenType = hashParams.get('token_type');

      if (accessToken) {
        // Forward all token params so the desktop app can reconstruct the session
        const params = new URLSearchParams();
        params.set('access_token', accessToken);
        if (refreshToken) params.set('refresh_token', refreshToken);
        if (expiresAt) params.set('expires_at', expiresAt);
        if (tokenType) params.set('token_type', tokenType);

        const deepLink = `taskflow://auth/callback?${params.toString()}`;
        fireDeepLink(deepLink);
        setStatus('success');
        return;
      }
    }

    setErrorMessage('No authentication code or token received from the provider.');
    setStatus('error');
  }, []);

  // Auto-close once deep link has been dispatched
  useEffect(() => {
    if (status !== 'success') return;

    window.close();

    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          window.close();
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
        <p style={{ color: '#888', margin: '0 0 1.5rem', fontSize: '0.95rem' }}>
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

function fireDeepLink(url: string) {
  // Hidden anchor click keeps this tab open.
  // Assigning window.location.href to a custom scheme navigates away on some OSes.
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}