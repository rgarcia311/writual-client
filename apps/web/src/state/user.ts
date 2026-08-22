import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tier } from '@/types/tier';

export interface UserSettings {
  colorMode: 'dark' | 'light';
  /**
   * Visible stat tiles per project page, keyed by page ('overview' | 'characters' | 'notes' |
   * 'outline'). Absent while the profile is still optimistic; a missing page key means that page
   * shows its default tiles. Persisted here only to paint the last known choice before the
   * server round-trip — the DB copy is the source of truth.
   */
  statTilePreferences?: Record<string, string[]> | null;
  /**
   * True once the intro walkthrough was completed or dismissed. Absent while the profile is still
   * optimistic — the walkthrough waits for the server copy rather than greeting a returning user
   * who already turned it off.
   */
  walkthroughDismissed?: boolean;
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
