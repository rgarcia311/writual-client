import { create } from 'zustand';

export interface ProjectCharacterDetail {
  version?: number;
  name?: string;
  gender?: string;
  age?: string | number;
  bio?: string;
  need?: string;
  want?: string;
}

export interface ProjectCharacterLookup {
  _id: string;
  name: string;
  imageUrl?: string;
  activeVersion?: number;
  lockedVersion?: number | null;
  details?: ProjectCharacterDetail[];
}

interface ScreenplayCharacterLookupState {
  /** Keyed by normalizeCharacterCueText(name) for O(1) lookup from the gutter button. */
  charactersByName: Record<string, ProjectCharacterLookup>;
  setCharacters: (characters: ProjectCharacterLookup[]) => void;
}

/** Character cue lines may carry extensions like "(V.O.)"/"(CONT'D)" or a trailing colon; strip before matching. */
export function normalizeCharacterCueText(text: string): string {
  return text
    .replace(/\([^)]*\)/g, '')
    .replace(/:$/, '')
    .trim()
    .toUpperCase();
}

export const useScreenplayCharacterLookupStore = create<ScreenplayCharacterLookupState>()((set) => ({
  charactersByName: {},
  setCharacters: (characters) => {
    const charactersByName: Record<string, ProjectCharacterLookup> = {};
    characters.forEach((character) => {
      const name = (character.name ?? '').trim();
      if (!name) return;
      charactersByName[normalizeCharacterCueText(name)] = character;
    });
    set({ charactersByName });
  },
}));
