import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tier } from '@/types/tier';

export interface UserSettings {
  colorMode: 'dark' | 'light';
}

export interface UserProfile {
  user: string;
  name: string | null;
  displayName: string | null;
  email: string | null;
  tier: Tier;           // never null for authenticated users — defaults to 'beta-access'
  settings: UserSettings; // never null — defaults to { colorMode: 'dark' }
}
interface UserState {
  userProfile: UserProfile | null;
  setUserProfile: (userProfile: UserProfile | null) => void;
}

export const useUserProfileStore = create<UserState>()(
  persist(
    (set) => ({
      userProfile: null,
      setUserProfile: (userProfile) => set({ userProfile }),
    }),
    {
      name: 'writual-user-profile',
     
    },
  ),
);
