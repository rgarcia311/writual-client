import { create } from 'zustand';
import type { User } from 'firebase/auth';

interface UserState {
  user: User | null;
  setUser: (user: User | null) => void;
}

export const useUserProfileStore = create<UserState>()((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
