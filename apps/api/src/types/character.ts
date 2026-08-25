export type CharacterDetails = {
  version?: number;
  bio?: string;
  name?: string;
  age?: number;
  gender?: string;
  need?: string;
  want?: string;
};

export type Character = {
  _id: string;
  projectId: string;
  imageUrl?: string;
  /** Portrait gallery in display order; the first entry mirrors `imageUrl`. */
  imageUrls?: string[];
  details: CharacterDetails[];
};
