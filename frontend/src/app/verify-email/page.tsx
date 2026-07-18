'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { api, getErrorMessage } from '@/lib/api';

function VerifyContent() {
  const params = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('No verification token provided');
      return;
    }
    api
      .get('/auth/verify-email', { params: { token } })
      .then((res) => {
        setState('success');
        setMessage(res.data.message || 'Email verified');
      })
      .catch((err) => {
        setState('error');
        setMessage(getErrorMessage(err));
      });
  }, [token]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="card p-8 max-w-md w-full text-center">
        {state === 'loading' && (
          <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-700 rounded-full animate-spin mx-auto mb-4"></div>
        )}
        {state === 'success' && (
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
        {state === 'error' && (
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        )}
        <h1 className="text-2xl font-bold mb-2">
          {state === 'success' ? 'Email verified!' : state === 'error' ? 'Verification failed' : 'Verifying...'}
        </h1>
        <p className="text-slate-600 mb-6">{message}</p>
        <Link href="/login" className="btn-primary">
          Go to login
        </Link>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-700 rounded-full animate-spin"></div>
        </main>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
