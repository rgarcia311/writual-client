import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from 'firebase/auth';

interface UserState {
  user: User | null;
  displayName: string | null;
  email: string | null;
  setUser: (user: User | null) => void;
}

export const useUserProfileStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      displayName: null,
      email: null,
      setUser: (user) => set({
        user,
        displayName: user?.displayName ?? null,
        email: user?.email ?? null,
      }),
    }),
    {
      name: 'writual-user-profile',
      partialize: (state) => ({
        displayName: state.displayName,
        email: state.email,
      }),
    },
  ),
);
