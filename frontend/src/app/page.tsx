'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

export default function HomePage() {
  const router = useRouter();
  const { user, isHydrated } = useAuthStore();

  useEffect(() => {
    if (isHydrated && user) router.replace('/dashboard');
  }, [isHydrated, user, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 px-4">
      <div className="max-w-2xl w-full text-center">
        <div className="inline-block px-3 py-1 text-xs font-semibold text-brand-700 bg-brand-100 rounded-full mb-6">
          Salon management, made simple
        </div>
        <h1 className="text-5xl font-bold text-slate-900 mb-6">
          Book your next <span className="text-brand-700">salon visit</span>
        </h1>
        <p className="text-lg text-slate-600 mb-10 max-w-lg mx-auto">
          Schedule haircuts, manicures, massages, and more — all with real-time
          availability and instant confirmations.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/register" className="btn-primary px-8 py-3 text-base">
            Get started
          </Link>
          <Link href="/login" className="btn-secondary px-8 py-3 text-base">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
