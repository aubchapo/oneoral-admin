'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from './types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock admin user for demo
const MOCK_ADMIN: User = {
  id: 'admin-001',
  email: 'alang@oneoral.com',
  name: 'Aubrey Lang',
  role: 'ADMIN',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

// Valid mock credentials
const MOCK_CREDENTIALS = [
  { email: 'alang@oneoral.com', password: 'admin123', user: MOCK_ADMIN },
  { email: 'dr.smith@oneoral.com', password: 'doctor123', user: { ...MOCK_ADMIN, id: 'dr-001', email: 'dr.smith@oneoral.com', name: 'Dr. John Smith', role: 'DOCTOR' as const } },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();

  // Use a separate effect for initialization that only runs once.
  // Real access control is the HTTP Basic gate in middleware.ts — anyone who
  // reaches this code is already authenticated, so sign them in automatically
  // instead of showing a second (mock) login form.
  useEffect(() => {
    if (initialized) return;

    let resolved: User | null = null;
    const savedUser = localStorage.getItem('admin_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        if (userData.role === 'ADMIN' || userData.role === 'DOCTOR') {
          resolved = userData;
        }
      } catch {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
      }
    }
    if (!resolved) {
      resolved = MOCK_ADMIN;
      localStorage.setItem('admin_token', 'auto-' + Date.now());
      localStorage.setItem('admin_user', JSON.stringify(MOCK_ADMIN));
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(resolved);
    setLoading(false);
    setInitialized(true);
  }, [initialized]);

  const login = async (email: string, password: string) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check mock credentials
    const match = MOCK_CREDENTIALS.find(
      cred => cred.email === email && cred.password === password
    );

    if (!match) {
      throw new Error('Invalid email or password');
    }

    localStorage.setItem('admin_token', 'mock-token-' + Date.now());
    localStorage.setItem('admin_user', JSON.stringify(match.user));
    setUser(match.user as User);
    router.push('/');
  };

  const logout = async () => {
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
