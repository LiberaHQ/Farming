'use client';

import { MenuNav } from './MenuNav';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WalletLogin } from '@/components/wallet';
import { useState } from 'react';
import { api, ApiError } from '@/services/api';

/** Log in or create an account. On success, back to the title screen. */
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isRegister = mode === 'register';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isRegister) await api.register(username, password);
      else await api.login(username, password);
      router.push('/start');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <main className="menu-page">
      <MenuNav />
      <header className="title">
        <h1>{isRegister ? 'Create account' : 'Log in'}</h1>
        <p className="hud-muted">
          {isRegister ? 'An account keeps your worlds safe and lets you play them on any device.' : 'Welcome back!'}
        </p>
      </header>
      <form className="card auth-form" onSubmit={submit}>
        <label>
          <span>Username</span>
          <input
            className="input"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_]+"
            required
          />
          {isRegister && <small className="hud-muted">3–20 letters, numbers or underscores</small>}
        </label>
        <label>
          <span>Password</span>
          <input
            className="input"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            maxLength={128}
            required
          />
          {isRegister && <small className="hud-muted">At least 8 characters</small>}
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
        </button>
        <div className="auth-or">
          <span>or</span>
        </div>
        <WalletLogin signedIn={false} onSignedIn={() => router.push('/start')} label={isRegister ? '🦊 Sign up with a wallet' : '🦊 Log in with a wallet'} />
        <small className="hud-muted">MetaMask or any Ethereum wallet. You sign a message to prove it's yours — no fees, no transaction. A new account is made the first time.</small>
        <p className="hud-muted">
          {isRegister ? (
            <>
              Already have an account? <Link href="/login">Log in</Link>
            </>
          ) : (
            <>
              New here? <Link href="/register">Create an account</Link>
            </>
          )}{' '}
          · <Link href="/start">Back</Link>
        </p>
      </form>
    </main>
  );
}
