import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from 'firebase/auth';

interface UserProfile {
  user: string;
  displayName: string | null;
  email: string | null;
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
