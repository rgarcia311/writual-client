import { z } from 'zod';

const textNodeSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

const elementTypeSchema = z.enum([
  'action',
  'slugline',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
  'title',
  'author',
  'contact',
]);

export const scriptBlockSchema = z.object({
  type: z.literal('scriptBlock'),
  attrs: z.object({
    elementType: elementTypeSchema,
  }),
  content: z.array(textNodeSchema).min(1),
});

export const screenplayDocSchema = z.object({
  type: z.literal('doc'),
  content: z.array(scriptBlockSchema),
});

export const groqImportResponseSchema = z.object({
  doc: screenplayDocSchema,
  titleHint: z.string().nullable().optional(),
});

/** One forward-pass of chunked conversion: root must be a JSON object (not a raw array). */
export const groqChunkResponseSchema = z.object({
  content: z.array(scriptBlockSchema),
  titleHint: z.string().nullable().optional(),
  logline: z.string().nullable().optional(),
  authors: z.array(z.string()).nullable().optional(),
  genre: z.string().nullable().optional(),
});

export type ScreenplayDoc = z.infer<typeof screenplayDocSchema>;
export type ScriptBlock = z.infer<typeof scriptBlockSchema>;
