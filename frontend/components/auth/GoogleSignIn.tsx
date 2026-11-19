'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError, type SessionUser } from '@/services/api';
import styles from './GoogleSignIn.module.css';

/** The bits of Google Identity Services' browser API we use. */
interface GoogleId {
  initialize(options: { client_id: string; callback: (r: { credential?: string }) => void; ux_mode?: 'popup'; auto_select?: boolean; cancel_on_tap_outside?: boolean; context?: 'signin' | 'signup' | 'use' }): void;
  renderButton(el: HTMLElement, options: { type?: 'standard'; theme?: 'outline' | 'filled_blue' | 'filled_black'; size?: 'large' | 'medium' | 'small'; text?: 'signin_with' | 'signup_with' | 'continue_with'; shape?: 'pill' | 'rectangular'; logo_alignment?: 'left'; width?: number; locale?: string }): void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

const SCRIPT = 'https://accounts.google.com/gsi/client';
let loading: Promise<GoogleId> | null = null;

/** Loads Google's sign-in script once per page. */
function loadGoogle(): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('Google sign-in did not load.')));
    s.onerror = () => {
      loading = null;
      reject(new Error('Could not reach Google. Check your connection.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * "Continue with Google": Google's own button. Signing in sends the ID token
 * Google gives us to the server, which checks it, then logs you in (or makes
 * your account the first time). Hidden when the server has no Google client ID.
 */
/** Google's "G" mark (for the placeholder shown while Google sign-in isn't set up). */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.3 5.7c4.3-4 7-9.9 7-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function GoogleSignIn({
  mode,
  onSignedIn,
  compact = false,
}: {
  mode: 'login' | 'register';
  onSignedIn: (user: SessionUser, created: boolean) => void;
  /** A smaller button that sits in a row of other buttons (the dashboard welcome card). */
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const done = useRef(onSignedIn);
  done.current = onSignedIn;

  useEffect(() => {
    api
      .googleConfig()
      .then((r) => setClientId(r.clientId))
      .catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (!clientId || !ref.current) return;
    let cancelled = false;
    const el = ref.current;
    loadGoogle()
      .then((google) => {
        if (cancelled) return;
        google.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
          context: mode === 'register' ? 'signup' : 'signin',
          callback: ({ credential }) => {
            if (!credential) return setError('Google sign-in was cancelled.');
            setBusy(true);
            setError(null);
            api
              .googleSignIn(credential)
              .then((r) => done.current(r.user, r.created))
              .catch((err) => {
                setError(err instanceof ApiError ? err.message : 'Google sign-in failed. Try again.');
                setBusy(false);
              });
          },
        });
        // Google's button has a fixed pixel width (200–400): fit it to the form.
        const width = compact ? 220 : Math.max(200, Math.min(400, Math.floor(el.clientWidth || 320)));
        // The game is in English, so the button is too (Google would otherwise follow the browser's language).
        google.renderButton(el, { type: 'standard', theme: 'filled_black', size: compact ? 'medium' : 'large', text: 'continue_with', shape: 'pill', logo_alignment: 'left', width, locale: 'en' });
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [clientId, mode, compact]);

  const wrapClass = compact ? `${styles.wrap} ${styles.compact}` : styles.wrap;
  if (clientId === undefined) return <div className={compact ? styles.compactSlot : styles.button} aria-hidden />;
  if (!clientId) {
    // Players never see a button that can't work; while developing, show where it goes and what it needs.
    if (process.env.NODE_ENV !== 'development') return null;
    const hint = 'Google sign-in is not set up yet: put GOOGLE_CLIENT_ID in backend/.env (see backend/.env.example) and restart the server.';
    return (
      <div className={wrapClass}>
        <button type="button" className={styles.placeholder} disabled title={hint}>
          <GoogleMark /> Continue with Google
        </button>
        {!compact && <p className={styles.note}>{hint}</p>}
      </div>
    );
  }
  return (
    <div className={wrapClass}>
      <div ref={ref} className={styles.button} aria-label="Continue with Google" />
      {busy && <p className={styles.note}>Signing you in…</p>}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
