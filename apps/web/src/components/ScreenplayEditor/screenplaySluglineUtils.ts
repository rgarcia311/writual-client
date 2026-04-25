/**
 * Classify a scene heading (slugline) for INT/EXT UI chips.
 * Handles common variants and hybrid I/E, INT/EXT, EXT/INT lines.
 */
export type SluglineLocation = 'INT' | 'EXT' | 'I_E' | 'OTHER'

/** Short label for collapsed scene chips. */
export function getSluglineChipLabel(loc: SluglineLocation): string {
  if (loc === 'I_E') return 'I/E'
  if (loc === 'OTHER') return '·'
  return loc
}

export function getSluglineLocation(heading: string | null | undefined): SluglineLocation {
  if (heading == null || typeof heading !== 'string') return 'OTHER'
  const t = heading.trim()
  if (!t) return 'OTHER'
  const u = t.toUpperCase()

  if (
    /\bI\/E\b/.test(u) ||
    u.includes('INT/EXT') ||
    u.includes('EXT/INT') ||
    /\bI\/E\./.test(u) ||
    u.startsWith('I/E') ||
    u.startsWith('I / E')
  ) {
    return 'I_E'
  }
  if (/^EXT[.\\/]/.test(u) || /^EXT\s/.test(u)) {
    return 'EXT'
  }
  if (/^INT[.\\/]/.test(u) || /^INT\s/.test(u)) {
    return 'INT'
  }
  return 'OTHER'
}
