import { create } from 'zustand';
import { disconnectSocket } from './socketStore';

const STORAGE_KEY = 'smart-queue-auth';

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { user: null, accessToken: null, refreshToken: null };
  } catch {
    return { user: null, accessToken: null, refreshToken: null };
  }
}

function persist(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}

export const useAuthStore = create((set) => ({
  ...loadInitial(),
  setSession: (user, accessToken, refreshToken) => {
    const next = { user, accessToken, refreshToken };
    persist(next);
    set(next);
  },
  clearSession: () => {
    const next = { user: null, accessToken: null, refreshToken: null };
    persist(next);
    set(next);
    disconnectSocket();
  },
}));
