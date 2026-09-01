/**
 * Pure, dependency-free predicates that recognise screenplay elements from a single line of text.
 *
 * Kept apart from `ScreenplayExtension.ts` so both the editor (which pulls in React, Tiptap and the
 * app stores) and plain-text tooling (clipboard parsing, unit tests) can share one definition of
 * "what does a scene heading / character cue / transition look like".
 */

/**
 * INT./EXT. prefix, including reversed and intercut forms (e.g. "INT./EXT.", "I/E.").
 * The trailing `(?:\s+|$)` accepts the prefix the instant it's typed (cursor right after the
 * period, before a location is typed) as well as once a space follows it.
 */
const SCENE_HEADING_PREFIX_RE =
  /^(INT\.|EXT\.|INT\.?\s*\/\s*EXT\.|EXT\.?\s*\/\s*INT\.|I\/E\.?)(?:\s+|$)/i

/** A dash followed by a time-of-day / temporal descriptor, e.g. "- DAY", "- CONTINUOUS". */
const SCENE_HEADING_TIME_SUFFIX_RE =
  /[-–—]\s*(DAY|NIGHT|MORNING|AFTERNOON|EVENING|DUSK|DAWN|SUNSET|SUNRISE|NOON|MIDNIGHT|CONTINUOUS|LATER|MOMENTS LATER|SAME TIME)\b/i

/**
 * True if the line reads like a scene heading: an INT./EXT. (or intercut) prefix,
 * or a "- <time of day>" suffix anywhere in the line.
 *
 * Only strips leading whitespace — NOT trailing — because the prefix match depends on the
 * trailing space the user just typed (e.g. "INT. " must stay "INT. ", not collapse to "INT.",
 * or the boundary right after the prefix is lost and the very keystroke that should trigger
 * the conversion is swallowed).
 */
export function isSceneHeadingText(text: string): boolean {
  const leadingTrimmed = text.replace(/^\s+/, '')
  if (!leadingTrimmed) return false
  return (
    SCENE_HEADING_PREFIX_RE.test(leadingTrimmed) || SCENE_HEADING_TIME_SUFFIX_RE.test(leadingTrimmed)
  )
}

/** Collapse runs of spaces/tabs and trim, without touching the line's inner punctuation. */
export function collapseSpaces(text: string): string {
  return text.replace(/[ \t]+/g, ' ').trim()
}

/** Named transitions that stand alone without a trailing "TO:" ("FADE OUT.", "THE END"). */
const TRANSITION_LITERAL_RE =
  /^(FADE\s+(IN|OUT)\.?:?|FADE\s+TO\s+BLACK\.?|THE\s+END\.?|END\s+OF\s+(ACT|EPISODE)\b.*|MAIN\s+TITLES?\.?)$/i

/** The general shape: a short upper-case phrase ending in "TO:" — "CUT TO:", "SMASH CUT TO:". */
const TRANSITION_TO_RE = /^[A-Z0-9 '’.\-/]{2,32}TO:$/

/** True for a transition line ("CUT TO:", "DISSOLVE TO:", "FADE OUT."). */
export function isTransitionText(text: string): boolean {
  const trimmed = collapseSpaces(text)
  if (!trimmed) return false
  return TRANSITION_LITERAL_RE.test(trimmed) || TRANSITION_TO_RE.test(trimmed)
}

/** A whole line wrapped in parentheses, e.g. "(beat)" or "(sitting up, annoyed)". */
export function isParentheticalText(text: string): boolean {
  const trimmed = collapseSpaces(text)
  return trimmed.length > 2 && trimmed.startsWith('(') && trimmed.endsWith(')')
}

/** Cue extensions that may trail a character name: "(V.O.)", "(O.S.)", "(CONT'D)". */
const CUE_EXTENSION_RE = /\((V\.?O\.?|O\.?S\.?|O\.?C\.?|CONT['’]?D|SUBTITLED|FILTERED|PRE-?LAP)\)/gi

/** Dual-dialogue marker some apps append to the cue. */
const CUE_DUAL_MARKER_RE = /\s*\^\s*$/

/**
 * True if the line looks like a character cue: upper case, short, no sentence-ending punctuation,
 * and followed by something that can be spoken.
 *
 * `hasSpeechBelow` is what separates a cue from a line of shouted action — an all-caps line with
 * nothing under it is not a cue.
 */
export function isCharacterCueText(text: string, hasSpeechBelow: boolean): boolean {
  if (!hasSpeechBelow) return false
  const trimmed = collapseSpaces(text).replace(CUE_DUAL_MARKER_RE, '')
  if (!trimmed || trimmed.length > 40) return false
  if (isSceneHeadingText(trimmed) || isTransitionText(trimmed)) return false
  const withoutExtension = trimmed.replace(CUE_EXTENSION_RE, '').trim()
  if (!withoutExtension) return false
  // A cue is a name, not a sentence: no terminal punctuation, and at least one letter.
  if (/[.!?,;:]$/.test(withoutExtension)) return false
  if (!/[A-Za-z]/.test(withoutExtension)) return false
  return withoutExtension === withoutExtension.toUpperCase()
}
