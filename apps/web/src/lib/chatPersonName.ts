/** A person as any chat payload carries them — a message sender or a conversation participant. */
export interface ChatPersonLike {
  displayName?: string | null;
  name?: string | null;
  email?: string | null;
}

/**
 * What to call someone in the chat.
 *
 * A collaborator is invited by email and becomes a conversation partner straight away, but has no
 * first or last name until they accept and sign in. Their email stands in until then, which at
 * least says who they are — 'Unknown' does not.
 */
export function chatPersonName(person: ChatPersonLike | null | undefined, fallback = 'Unknown'): string {
  return person?.displayName?.trim()
    || person?.name?.trim()
    || person?.email?.trim()
    || fallback;
}

/**
 * The same label, title-cased when it is a real name. Emails are left exactly as stored — casing
 * them up would turn an address into something that no longer matches what was invited.
 */
export function chatPersonDisplayName(person: ChatPersonLike | null | undefined, fallback = 'Unknown'): string {
  const label = chatPersonName(person, fallback);
  if (label.includes('@')) return label;
  return label.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
