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
    // We check localStorage for initial fast render, but Firebase Auth & Server Cookies are the source of truth
    const savedUser = localStorage.getItem('spaceborn_user');
    const savedVendor = localStorage.getItem('spaceborn_vendor');
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedVendor) setVendorStore(JSON.parse(savedVendor));
    
    // Listen to Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Get the ID token and its decoded claims
          const idToken = await firebaseUser.getIdToken(true);
          const idTokenResult = await firebaseUser.getIdTokenResult();
          
          // CRITICAL: Strictly verify the 'vendor' claim for the Vendor Hub
          if (!idTokenResult.claims.vendor) {
            console.error("Access Denied: User does not have 'vendor' claim.");
            await firebaseSignOut(auth);
            return;
          }

          // Send token to Next.js Edge backend to set secure HTTP-only session cookie
          await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: idToken }),
          });
          
        } catch (error) {
          console.error("Error setting session cookie or verifying claims", error);
        }
      } else {
        // If Firebase signs out, clear local state and backend session
        setUser(null);
        setVendorStore(null);
        localStorage.removeItem('spaceborn_user');
        localStorage.removeItem('spaceborn_vendor');
        try {
          await fetch('/api/logout', { method: 'POST' });
        } catch (e) {}
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
      
      const idTokenResult = await firebaseUser.getIdTokenResult();
      if (!idTokenResult.claims.vendor) {
        await firebaseSignOut(auth);
        throw new Error("Access Denied: You are not authorized as a Vendor.");
      }

      createUserState(role, firebaseUser.email || '', firebaseUser.displayName || 'Google User', city);
    } catch (error: any) {
      if (error.code === 'auth/configuration-not-found') {
        console.warn("Google Auth not configured in this environment. Falling back to local state for dev.");
        createUserState(role, 'vendor@spaceborn.io', 'Vendor Developer', city);
      } else {
        console.error("Google Sign-In Error", error);
        throw error;
      }
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      await fetch('/api/logout', { method: 'POST' });
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
