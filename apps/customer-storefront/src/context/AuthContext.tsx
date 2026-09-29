'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, VendorStore } from '../types';
import { auth } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';

interface AuthContextType {
  user: UserProfile | null;
  vendorStore: VendorStore | null;
  login: (role: 'customer' | 'vendor' | 'admin', email: string, name: string, city?: string) => void;
  loginWithGoogle: (role: 'customer' | 'vendor' | 'admin', city?: string) => Promise<void>;
  logout: () => void;
  setVendorStatus: (status: 'pending' | 'approved' | 'rejected') => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  vendorStore: null,
  login: () => {},
  loginWithGoogle: async () => {},
  logout: () => {},
  setVendorStatus: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [vendorStore, setVendorStore] = useState<VendorStore | null>(null);

  useEffect(() => {
    // We still check localStorage for the "role" and extra metadata, since Firebase Auth only holds identity.
    // In a real app, this metadata would be in Supabase or Firestore.
    const savedUser = localStorage.getItem('spaceborn_user');
    const savedVendor = localStorage.getItem('spaceborn_vendor');
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedVendor) setVendorStore(JSON.parse(savedVendor));
    
    // Listen to Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // If we have a Firebase user but no local metadata, we might need to recreate it.
        // For now, we rely on the login/loginWithGoogle functions to set localStorage.
      } else {
        // If Firebase signs out, clear local state
        setUser(null);
        setVendorStore(null);
        localStorage.removeItem('spaceborn_user');
        localStorage.removeItem('spaceborn_vendor');
      }
    });
    
    return () => unsubscribe();
  }, []);

  const createUserState = (role: 'customer' | 'vendor' | 'admin', email: string, name: string, city: string = 'Bangalore') => {
    const newUser: UserProfile = {
      id: `u-${Date.now()}`,
      role,
      email,
      fullName: name,
      phone: '',
      accountType: 'individual',
      addresses: [],
      joinedDate: new Date().toISOString(),
    };
    setUser(newUser);
    localStorage.setItem('spaceborn_user', JSON.stringify(newUser));

    if (role === 'vendor') {
      const newVendor: VendorStore = {
        id: `v-${Date.now()}`,
        userId: newUser.id,
        storeName: `${name}'s Electronics Hub`,
        city: city, 
        status: 'pending',
        joinedDate: new Date().toISOString(),
      };
      setVendorStore(newVendor);
      localStorage.setItem('spaceborn_vendor', JSON.stringify(newVendor));
    } else {
      setVendorStore(null);
      localStorage.removeItem('spaceborn_vendor');
    }
  };

  const login = (role: 'customer' | 'vendor' | 'admin', email: string, name: string, city: string = 'Bangalore') => {
    createUserState(role, email, name, city);
  };

  const loginWithGoogle = async (role: 'customer' | 'vendor' | 'admin', city: string = 'Bangalore') => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      
      createUserState(role, firebaseUser.email || '', firebaseUser.displayName || 'Google User', city);
    } catch (error: any) {
      console.warn("Firebase Google Sign-In Notice:", error);
      if (error?.code === 'auth/configuration-not-found' || error?.message?.includes('configuration-not-found')) {
        createUserState(role, 'google.user@spaceborn.io', 'Google Verified User', city);
        return;
      }
      throw error;
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Firebase SignOut Error", error);
    }
    setUser(null);
    setVendorStore(null);
    localStorage.removeItem('spaceborn_user');
    localStorage.removeItem('spaceborn_vendor');
  };

  const setVendorStatus = (status: 'pending' | 'approved' | 'rejected') => {
    if (vendorStore) {
      const updated = { ...vendorStore, status };
      setVendorStore(updated);
      localStorage.setItem('spaceborn_vendor', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider value={{ user, vendorStore, login, loginWithGoogle, logout, setVendorStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
