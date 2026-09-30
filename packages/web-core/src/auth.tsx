'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { firebaseAuth } from './firebase';
import type { Role } from './types';

export interface SessionUser {
  uid: string;
  email: string | null;
  name: string | null;
  role: Role;
  storeId: string | null;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshClaims: () => Promise<SessionUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLES: Role[] = ['customer', 'vendor', 'admin'];

const DEFAULT_ADMIN_EMAILS = ['oumgupta555@gmail.com'];

// Role is display-only on the client. Every permission is enforced again by the API.
async function toSessionUser(user: User, forceRefresh = false): Promise<SessionUser> {
  const { claims } = await user.getIdTokenResult(forceRefresh);
  let role = ROLES.includes(claims.role as Role) ? (claims.role as Role) : 'customer';
  let storeId = typeof claims.storeId === 'string' ? claims.storeId : null;

  if (user.email && DEFAULT_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    role = 'admin';
  } else {
    try {
      const { api } = await import('./api');
      const meRes = await api<{ user: { role: Role; storeId?: string | null } }>('/me');
      if (meRes.user?.role && ROLES.includes(meRes.user.role)) {
        role = meRes.user.role;
      }
      if (meRes.user?.storeId) {
        storeId = meRes.user.storeId;
      }
    } catch {}
  }

  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    role,
    storeId,
  };
}

const FRIENDLY_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Use a password with at least 8 characters.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/configuration-not-found': 'Firebase Authentication is not activated yet. In Firebase Console, go to Authentication and click "Get started".',
  'auth/operation-not-allowed': 'Google Sign-in is not enabled yet in Firebase Console under Authentication > Sign-in method.',
  'auth/unauthorized-domain': 'This domain is not authorized. Please add d2w4nxdybzrkls.cloudfront.net to Authorized domains in Firebase Console.',
};

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  const rawMessage = (err as Error)?.message || '';
  if (rawMessage.includes('CONFIGURATION_NOT_FOUND')) {
    return 'Firebase Authentication is not activated yet in Firebase Console (Authentication > Get started).';
  }
  return (code && FRIENDLY_ERRORS[code]) || (err as Error)?.message || 'Sign-in failed. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onIdTokenChanged(firebaseAuth(), async (firebaseUser) => {
        setUser(firebaseUser ? await toSessionUser(firebaseUser) : null);
        setLoading(false);
      }),
    [],
  );

  const refreshClaims = useCallback(async () => {
    const current = firebaseAuth().currentUser;
    if (!current) return null;
    const next = await toSessionUser(current, true);
    setUser(next);
    return next;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refreshClaims,
      signInWithGoogle: async () => {
        await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
      },
      signInWithEmail: async (email, password) => {
        await signInWithEmailAndPassword(firebaseAuth(), email, password);
      },
      signUpWithEmail: async (name, email, password) => {
        const { user: created } = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
        await updateProfile(created, { displayName: name });
        setUser(await toSessionUser(created, true));
      },
      signOut: () => firebaseSignOut(firebaseAuth()),
    }),
    [user, loading, refreshClaims],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
