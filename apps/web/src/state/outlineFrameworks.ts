import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OutlineFrameworkItem {
  _id?: string;
  id: string;
  user?: string;
  name: string;
  imageUrl?: string;
  format?: {
    format_id?: string;
    name?: string;
    steps?: Array<{
      step_id?: string;
      name?: string;
      number?: number;
      act?: string;
      instructions?: string;
    }>;
  };
}

interface OutlineFrameworksState {
  frameworks: OutlineFrameworkItem[];
  setFrameworks: (frameworks: OutlineFrameworkItem[]) => void;
}

const STORAGE_KEY = 'writual-outline-frameworks';

export const useOutlineFrameworksStore = create<OutlineFrameworksState>()(
  persist(
    (set) => ({
      frameworks: [],
      setFrameworks: (frameworks) => set({ frameworks }),
    }),
    { name: STORAGE_KEY }
  )
);
