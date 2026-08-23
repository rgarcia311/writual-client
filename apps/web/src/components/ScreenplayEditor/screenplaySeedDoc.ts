/**
 * The document a screenplay starts life as.
 *
 * Two callers build one: the editor, when it opens a document that has never been saved, and the
 * "new screenplay" dialog, when the writer asks for a blank one. Keeping both on these helpers is
 * what makes "blank" mean the same thing in both places — and keeps the scriptBlock shapes in one
 * file rather than spread across the editor and the dialog.
 */

import type { ProjectScene } from '@/state/screenplaySceneOutline'

function getSceneHeading(scene: ProjectScene): string {
  const idx = Math.max(0, (scene.activeVersion ?? 1) - 1)
  return (scene.versions?.[idx]?.sceneHeading ?? '').trim()
}

/** Build a TipTap doc seeded with scene headings from the outline. */
function buildDocFromScenes(scenes: ProjectScene[]): Record<string, unknown> {
  const blocks = scenes.flatMap((scene) => {
    const heading = getSceneHeading(scene).toUpperCase()
    return [
      {
        type: 'scriptBlock',
        attrs: { elementType: 'slugline' },
        content: heading ? [{ type: 'text', text: heading }] : [],
      },
      {
        type: 'scriptBlock',
        attrs: { elementType: 'action' },
        content: [],
      },
    ]
  })
  return { type: 'doc', content: blocks }
}

/** Placeholder shown when the user's full name can't be determined from their profile. */
const CONTACT_NAME_PLACEHOLDER = 'Contact Name'
/** Placeholder shown when the user's email can't be determined from their profile. */
const CONTACT_EMAIL_PLACEHOLDER = 'Contact Email'

/**
 * `title` / `author` / `contact` scriptBlocks pre-filled from the project + signed-in user, to
 * prepend to a freshly seeded (never-before-saved) screenplay doc. Contact name/email fall back to
 * literal placeholder text so the user has something in-place to edit; the phone number is always a
 * placeholder since it isn't stored on the user profile.
 */
export function buildTitlePageBlocks(
  projectTitle: string | null | undefined,
  userDisplayName: string | null | undefined,
  userName: string | null | undefined,
  userEmail: string | null | undefined,
): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = []

  const trimmedTitle = (projectTitle ?? '').trim()
  if (trimmedTitle) {
    blocks.push({
      type: 'scriptBlock',
      attrs: { elementType: 'title' },
      content: [{ type: 'text', text: trimmedTitle }],
    })
  }

  const contactName = (userDisplayName || userName || '').trim() || CONTACT_NAME_PLACEHOLDER
  const contactEmail = (userEmail ?? '').trim() || CONTACT_EMAIL_PLACEHOLDER

  blocks.push({
    type: 'scriptBlock',
    attrs: { elementType: 'author' },
    content: [
      {
        type: 'text',
        text: contactName === CONTACT_NAME_PLACEHOLDER ? 'written by' : `written by ${contactName}`,
      },
    ],
  })

  for (const line of [contactName, contactEmail, 'Contact Phone Number']) {
    blocks.push({
      type: 'scriptBlock',
      attrs: { elementType: 'contact' },
      content: [{ type: 'text', text: line }],
    })
  }

  return blocks
}

/** Body seeded when a project has no outline scenes yet. */
const FALLBACK_BODY_BLOCKS: Record<string, unknown>[] = [
  {
    type: 'scriptBlock',
    attrs: { elementType: 'slugline' },
    content: [{ type: 'text', text: 'INT. YOUR SCENE - DAY' }],
  },
  {
    type: 'scriptBlock',
    attrs: { elementType: 'action' },
    content: [
      {
        type: 'text',
        text: 'Add scenes in the Outline tab to pre-populate scene headings here.',
      },
    ],
  },
]

export const TITLE_PAGE_ELEMENT_TYPES = new Set(['title', 'author', 'contact'])

/** Body content (scene-derived or fallback) with the title page prepended, for seeding a brand-new doc. */
export function buildSeedDoc(
  projectScenes: ProjectScene[],
  titlePageBlocks: Record<string, unknown>[],
): Record<string, unknown> {
  const bodyBlocks = projectScenes.length
    ? ((buildDocFromScenes(projectScenes).content as Record<string, unknown>[]) ?? [])
    : FALLBACK_BODY_BLOCKS
  return { type: 'doc', content: [...titlePageBlocks, ...bodyBlocks] }
}

function scriptBlockElementType(block: unknown): string {
  return (block as { attrs?: { elementType?: string } })?.attrs?.elementType ?? ''
}

function scriptBlockText(block: unknown): string {
  const content = (block as { content?: Array<{ text?: string }> })?.content
  if (!Array.isArray(content)) return ''
  return content.map((node) => node?.text ?? '').join('')
}

/**
 * True when `doc`'s body (everything but the title/author/contact blocks) is still exactly the
 * untouched no-scenes fallback — i.e. nothing the user or a scene-derived seed ever wrote. Compares
 * only element type + text, not the full node (scriptBlock also carries `versions`/`activeVersionId`
 * attrs that Tiptap fills with schema defaults on `setContent`, so a full deep-equal against the
 * plain seed literal never matches the editor's actual `getJSON()` output). Safe to replace because
 * real typed content (a real scene heading, dialogue, etc.) can never match this exact text.
 */
export function isUntouchedFallbackBody(doc: unknown): boolean {
  const content = (doc as { content?: unknown[] } | null)?.content
  if (!Array.isArray(content)) return false
  const body = content
    .filter((block) => !TITLE_PAGE_ELEMENT_TYPES.has(scriptBlockElementType(block)))
    .map((block) => ({ elementType: scriptBlockElementType(block), text: scriptBlockText(block) }))
  const fallback = FALLBACK_BODY_BLOCKS.map((block) => ({
    elementType: scriptBlockElementType(block),
    text: scriptBlockText(block),
  }))
  return JSON.stringify(body) === JSON.stringify(fallback)
}

/**
 * A screenplay with nothing in it but its title page and somewhere to start typing.
 *
 * Deliberately not `buildSeedDoc`: a writer who asks for a blank screenplay does not want the
 * project's outline poured into it. Saved as the new document's content at creation time, which is
 * also what keeps the editor's seeding — outline-derived or fallback — from running on first open.
 */
export function buildBlankDoc(
  titlePageBlocks: Record<string, unknown>[],
): Record<string, unknown> {
  return {
    type: 'doc',
    content: [
      ...titlePageBlocks,
      { type: 'scriptBlock', attrs: { elementType: 'slugline' }, content: [] },
    ],
  }
}
