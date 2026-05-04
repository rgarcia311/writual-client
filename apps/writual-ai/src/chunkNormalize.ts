import { groqChunkResponseSchema } from './screenplaySchema';
import type { CompletionResult } from './providers/types';

const VALID_ELEMENT_TYPES = new Set([
  'action',
  'slugline',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
]);

export function normalizeChunkPayload(parsed: unknown): unknown {
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return parsed;
  }
  const o = parsed as Record<string, unknown>;
  const rawContent = o.content;
  if (!Array.isArray(rawContent)) {
    return parsed;
  }
  const content = rawContent.map((item) => {
    if (item == null || typeof item !== 'object' || Array.isArray(item)) {
      return {
        type: 'scriptBlock' as const,
        attrs: { elementType: 'action' as const },
        content: [{ type: 'text' as const, text: '' }],
      };
    }
    const b = item as Record<string, unknown>;
    if (b.type !== 'scriptBlock') {
      return {
        type: 'scriptBlock' as const,
        attrs: { elementType: 'action' as const },
        content: [{ type: 'text' as const, text: String(b.text ?? '') }],
      };
    }
    const attrs = b.attrs;
    const elementType =
      attrs &&
      typeof attrs === 'object' &&
      !Array.isArray(attrs) &&
      typeof (attrs as { elementType?: unknown }).elementType === 'string' &&
      VALID_ELEMENT_TYPES.has(
        (attrs as { elementType: string }).elementType.trim().toLowerCase(),
      )
        ? ((attrs as { elementType: string }).elementType
            .trim()
            .toLowerCase() as
            | 'action'
            | 'slugline'
            | 'character'
            | 'parenthetical'
            | 'dialogue'
            | 'transition')
        : ('action' as const);

    let inner = b.content;
    if (!Array.isArray(inner) || inner.length === 0) {
      inner = [{ type: 'text' as const, text: '' }];
    } else {
      inner = inner.map((node) => {
        if (node == null || typeof node !== 'object' || Array.isArray(node)) {
          return { type: 'text' as const, text: '' };
        }
        const n = node as Record<string, unknown>;
        if (n.type === 'text' && typeof n.text === 'string') {
          return { type: 'text' as const, text: n.text };
        }
        return { type: 'text' as const, text: String(n.text ?? '') };
      });
    }
    return {
      type: 'scriptBlock' as const,
      attrs: { elementType },
      content: inner,
    };
  });
  return { ...o, content };
}

export function stripMarkdownJsonWrapper(raw: string): string {
  const match = raw.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  return match ? match[1]! : raw;
}

export function parseAndValidateChunkJSON(raw: string): Omit<CompletionResult, 'usage'> {
  const sanitized = stripMarkdownJsonWrapper(raw.trim());
  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitized) as unknown;
  } catch {
    throw new Error('Model returned non-JSON');
  }
  const coerced = normalizeChunkPayload(parsed);
  const validated = groqChunkResponseSchema.safeParse(coerced);
  if (!validated.success) {
    throw new Error(`Invalid chunk JSON from model: ${validated.error.message}`);
  }
  return {
    content: validated.data.content,
    titleHint: validated.data.titleHint,
    logline: validated.data.logline,
    authors: validated.data.authors,
    genre: validated.data.genre,
  };
}
