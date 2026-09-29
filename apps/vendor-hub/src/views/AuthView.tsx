'use client';
import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2, LockKeyhole, Mail, UserRound, Store, Shield } from 'lucide-react';
import { AppView, UserProfile } from '../types';
import { SpacebornLogo } from '../components/SpacebornLogo';
import { useAuth } from '../context/AuthContext';

interface AuthViewProps {
  onLoginSuccess?: (user: UserProfile) => void;
  onNavigate: (view: AppView) => void;
  initialMode?: 'login' | 'signup';
}

export function AuthView({ onLoginSuccess, onNavigate, initialMode = 'login' }: AuthViewProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(initialMode);
  const [role, setRole] = useState<'customer' | 'vendor' | 'admin'>('customer');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('Bangalore');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { login, loginWithGoogle, user } = useAuth();

  const selectTab = (tab: 'login' | 'signup') => {
    setActiveTab(tab);
    setErrorMessage(null);
    setPassword('');
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle(role, city);
      if (role === 'admin') {
        onNavigate('admin');
      } else if (role === 'vendor') {
        onNavigate('vendor');
      } else {
        onNavigate('catalog');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to authenticate with Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    
    if (activeTab === 'signup' && password.length < 4) {
      setErrorMessage('Use a password with at least 4 characters.');
      return;
    }

    setLoading(true);
    
    // Simulate network delay
    setTimeout(() => {
      try {
        const userName = activeTab === 'signup' ? fullName : email.split('@')[0];
        login(role, email, userName, city);
        
        if (role === 'admin') {
          onNavigate('admin');
        } else if (role === 'vendor') {
          onNavigate('vendor');
        } else {
          onNavigate('catalog');
        }
      } catch (err) {
        setErrorMessage('Failed to authenticate');
      } finally {
        setLoading(false);
      }
    }, 800);
  };

  return (
    <main className="min-h-[75vh] bg-slate-50 px-4 py-10 flex items-center justify-center">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 flex justify-center"><SpacebornLogo size="md" /></div>
        <h1 className="text-center text-2xl font-bold text-slate-900">
          {activeTab === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          {activeTab === 'login' ? 'Sign in to continue to your account.' : 'Join the fastest electronics marketplace.'}
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1 mb-4">
          <button type="button" onClick={() => selectTab('login')} className={`rounded-md py-2 text-sm font-semibold transition ${activeTab === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            Sign in
          </button>
          <button type="button" onClick={() => selectTab('signup')} className={`rounded-md py-2 text-sm font-semibold transition ${activeTab === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            Sign up
          </button>
        </div>

        {/* Role Selection */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Continue as</p>
          <div className="grid grid-cols-3 gap-2">
            <button 
              type="button"
              onClick={() => setRole('customer')}
              className={`flex flex-col items-center p-2 rounded-xl border transition ${role === 'customer' ? 'border-[#EF4F12] bg-[#EF4F12]/5 text-[#EF4F12]' : 'border-slate-200 text-slate-500 hover:border-[#EF4F12]/30 hover:bg-slate-50'}`}
            >
              <UserRound className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-bold">Customer</span>
            </button>
            <button 
              type="button"
              onClick={() => setRole('vendor')}
              className={`flex flex-col items-center p-2 rounded-xl border transition ${role === 'vendor' ? 'border-[#0c831f] bg-[#0c831f]/5 text-[#0c831f]' : 'border-slate-200 text-slate-500 hover:border-[#0c831f]/30 hover:bg-slate-50'}`}
            >
              <Store className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-bold">Vendor</span>
            </button>
            <button 
              type="button"
              onClick={() => setRole('admin')}
              className={`flex flex-col items-center p-2 rounded-xl border transition ${role === 'admin' ? 'border-[#34222e] bg-[#34222e]/5 text-[#34222e]' : 'border-slate-200 text-slate-500 hover:border-[#34222e]/30 hover:bg-slate-50'}`}
            >
              <Shield className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-bold">Admin</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="mt-6">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            {activeTab === 'login' ? 'Sign in with Google' : 'Sign up with Google'}
          </button>
        </div>

        <div className="relative mt-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm font-medium leading-6">
            <span className="bg-white px-4 text-slate-500">Or continue with</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {activeTab === 'signup' && (
            <label className="block text-sm font-medium text-slate-700">
              Full Name or Store Name
              <span className="relative mt-1.5 block">
                <UserRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Spaceborn / Your Name" className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15" />
              </span>
            </label>
          )}

          {activeTab === 'signup' && role === 'vendor' && (
            <label className="block text-sm font-medium text-slate-700">
              City (Location)
              <select value={city} onChange={(e) => setCity(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 py-2.5 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 bg-white">
                <option value="Bangalore">Bangalore</option>
                <option value="Kanpur">Kanpur</option>
                <option value="Pune">Pune</option>
                <option value="Chennai">Chennai</option>
                <option value="Gurugram">Gurugram</option>
              </select>
            </label>
          )}

          <label className="block text-sm font-medium text-slate-700">
            Email address
            <span className="relative mt-1.5 block">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15" />
            </span>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Password
            <span className="relative mt-1.5 block">
              <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'} type={showPassword ? 'text' : 'password'} minLength={4} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={activeTab === 'signup' ? 'At least 4 characters' : 'Your password'} className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-10 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15" />
              <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          <button type="submit" disabled={loading} className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
            role === 'admin' ? 'bg-[#34222e] hover:bg-[#1f141b]' :
            role === 'vendor' ? 'bg-[#0c831f] hover:bg-[#096618]' :
            'bg-[#EF4F12] hover:bg-[#d4430e]'
          }`}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Please wait...' : activeTab === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">
          {activeTab === 'login' ? 'New here? ' : 'Already have an account? '}
          <button type="button" onClick={() => selectTab(activeTab === 'login' ? 'signup' : 'login')} className="font-semibold text-[#EF4F12] hover:underline">
            {activeTab === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </section>
    </main>
  );
}
