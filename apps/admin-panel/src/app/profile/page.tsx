'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../context/StoreContext';
import { AccountProfileView } from '../../views/AccountProfileView';

export default function ProfilePage() {
  const router = useRouter();
  const { currentUser, setCurrentUser, logoutUser } = useStore();

  if (!currentUser) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 space-y-4">
        <h2 className="text-xl font-bold text-[#34222e]">Please Sign In</h2>
        <p className="text-xs text-[#7a6274]">Sign in to access your business profile and delivery addresses.</p>
        <button
          onClick={() => router.push('/auth')}
          className="px-5 py-2.5 bg-[#0c831f] text-white text-xs font-bold rounded-xl"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  return (
    <AccountProfileView
      user={currentUser}
      onUpdateProfile={(updated) => setCurrentUser(updated)}
      onSignOut={() => {
        logoutUser();
        router.push('/');
      }}
      onNavigate={(view) => {
        if (view === 'catalog') router.push('/catalog');
        else if (view === 'home') router.push('/');
        else router.push(`/${view}`);
      }}
    />
  );
}
