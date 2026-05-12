import { z } from 'zod';

/** Model output: refined character rows for import. */
export const characterRefineOutputSchema = z.object({
  characters: z.array(z.object({ name: z.string() })),
});

/** Model output: thesis / antithesis / synthesis aligned to scene indices in the batch. */
export const sceneBatchOutputSchema = z.object({
  sceneAnalyses: z.array(
    z.object({
      index: z.number(),
      thesis: z.string(),
      antithesis: z.string(),
      synthesis: z.string(),
    }),
  ),
});

export type CharacterRefineOutput = z.infer<typeof characterRefineOutputSchema>;
export type SceneBatchOutput = z.infer<typeof sceneBatchOutputSchema>;
