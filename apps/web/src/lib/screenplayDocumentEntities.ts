/**
 * Filtering character and scene cards by the screenplay document they belong to.
 *
 * A card's `screenplayDocumentId` is null when it predates multi-document support, or when it was
 * created by hand rather than derived from an imported script. Those cards belong to the project's
 * primary document by convention — the alternative, hiding them until someone tags them, would make
 * every existing project look empty the moment a second screenplay is added.
 */

export interface DocumentScopedEntity {
  screenplayDocumentId?: string | null
}

export interface DocumentScopeContext {
  /** The tab currently selected. */
  activeDocumentId: string | null
  /** The project's primary document, which untagged cards are treated as belonging to. */
  primaryDocumentId: string | null
}

export function belongsToDocument(
  entity: DocumentScopedEntity,
  { activeDocumentId, primaryDocumentId }: DocumentScopeContext,
): boolean {
  // With no selection resolved yet, show everything rather than flashing an empty grid.
  if (!activeDocumentId) return true
  const tagged = entity.screenplayDocumentId
  if (tagged != null && tagged !== '') return tagged === activeDocumentId
  return activeDocumentId === primaryDocumentId
}

export function filterByDocument<T extends DocumentScopedEntity>(
  entities: T[],
  context: DocumentScopeContext,
): T[] {
  return entities.filter((entity) => belongsToDocument(entity, context))
}
