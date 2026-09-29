'use client';

import { useState, type FormEvent } from 'react';
import { authErrorMessage, useAuth } from './auth';

interface SignInPanelProps {
  title: string;
  subtitle: string;
  allowSignUp?: boolean;
}

export function SignInPanel({ title, subtitle, allowSignUp = false }: SignInPanelProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    run(() => (mode === 'signup' ? signUpWithEmail(name.trim(), email.trim(), password) : signInWithEmail(email.trim(), password)));
  };

  const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';

  return (
    <div className="mx-auto mt-16 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button
        type="button"
        disabled={busy}
        onClick={() => run(signInWithGoogle)}
        className="mt-5 w-full rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
      >
        Continue with Google
      </button>

      <form onSubmit={submit} className="mt-5 space-y-3">
        {mode === 'signup' && (
          <label className="block text-xs font-semibold text-slate-600">
            Full name
            <input className={input} required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label className="block text-xs font-semibold text-slate-600">
          Email
          <input className={input} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          Password
          <input
            className={input}
            type="password"
            required
            minLength={mode === 'signup' ? 8 : 1}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      {allowSignUp && (
        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="mt-4 w-full text-center text-xs font-semibold text-slate-600 hover:underline"
        >
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      )}
    </div>
  );
}
