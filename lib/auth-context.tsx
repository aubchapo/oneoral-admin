'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from './types';
import { authApi } from './api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('admin_token');
      if (token) {
        try {
          const userData = await authApi.getMe();
          // Only allow admin users
          if (userData.role === 'ADMIN' || userData.role === 'DOCTOR') {
            setUser(userData);
          } else {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_user');
          }
        } catch {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const { user: userData, token } = await authApi.login(email, password);

    // Only allow admin or doctor users
    if (userData.role !== 'ADMIN' && userData.role !== 'DOCTOR') {
      throw new Error('Access denied. Admin or Doctor privileges required.');
    }

    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_user', JSON.stringify(userData));
    setUser(userData as User);
    router.push('/');
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    }
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
