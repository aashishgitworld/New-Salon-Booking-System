'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';

const schema = z.object({
  firstName: z.string().min(1, 'Required').max(100),
  lastName: z.string().min(1, 'Required').max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[a-z]/, 'Needs a lowercase letter')
    .regex(/[A-Z]/, 'Needs an uppercase letter')
    .regex(/\d/, 'Needs a number')
    .regex(/[@$!%*?&#^()_\-+=.,]/, 'Needs a special character'),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await api.post('/auth/register', data);
      toast.success('Check your email to verify your account');
      setSubmitted(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="card p-8 max-w-md w-full text-center">
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
          <h1 className="text-2xl font-bold mb-2">Check your email</h1>
          <p className="text-slate-600 mb-6">
            We sent you a verification link. Click it to activate your account.
          </p>
          <Link href="/login" className="btn-primary">
            Back to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="card p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-2">Create an account</h1>
        <p className="text-slate-600 mb-6">Start booking your salon services</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First name</label>
              <input className="input" {...register('firstName')} />
              {errors.firstName && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">Last name</label>
              <input className="input" {...register('lastName')} />
              {errors.lastName && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" {...register('email')} />
            {errors.email && (
              <p className="text-red-600 text-sm mt-1">
                {errors.email.message}
              </p>
            )}
          </div>
          <div>
            <label className="label">Phone (optional)</label>
            <input className="input" {...register('phone')} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" {...register('password')} />
            {errors.password && (
              <p className="text-red-600 text-sm mt-1">
                {errors.password.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full"
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="text-center text-sm text-slate-600 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-700 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
