'use client';

import { create } from 'zustand';
import { User } from './types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isHydrated: boolean;
  login: (user: User, accessToken: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isHydrated: false,

  login: (user, accessToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('user', JSON.stringify(user));
    }
    set({ user, accessToken });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
    }
    set({ user: null, accessToken: null });
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('accessToken');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        set({
          user: JSON.parse(userStr),
          accessToken: token,
          isHydrated: true,
        });
        return;
      } catch {
        // fall through
      }
    }
    set({ isHydrated: true });
  },
}));
