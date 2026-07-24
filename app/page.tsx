'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/dashboard' : '/login');
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
    </div>
  );
}
