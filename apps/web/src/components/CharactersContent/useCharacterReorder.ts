'use client';

import * as React from 'react';

export interface CharacterDragProps {
  draggable: boolean;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnter: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  onDragEnd: () => void;
}

export interface UseCharacterReorderResult {
  /** Ids in the order to render: the pending drag order while dragging, the server order otherwise. */
  orderedIds: string[];
  /** Id of the card being dragged, or null. */
  draggingId: string | null;
  /** Drag handlers for one card; spread onto the card's root element. */
  getDragProps: (characterId: string) => CharacterDragProps;
  /** Drops the local order so the grid falls back to the server's — used when a save fails. */
  clearPendingOrder: () => void;
}

/** Moves `id` to the slot currently held by `targetId`, shifting the rest along. */
function moveBefore(ids: string[], id: string, targetId: string): string[] {
  const from = ids.indexOf(id);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Click-and-drag reordering for the Characters page grid.
 *
 * Cards reflow live as the pointer passes over them, so the drop lands where the preview showed.
 * The reordered list is held locally until the mutation's refetch returns the same order from the
 * server, which keeps the grid from snapping back to the old order for a frame mid-save.
 *
 * `ids` is the visible tab's cast only. Cards that appear or disappear (tab switch, create, delete)
 * discard any pending local order, since it no longer describes what is on screen.
 */
export function useCharacterReorder(
  ids: string[],
  onCommit: (orderedIds: string[]) => void,
): UseCharacterReorderResult {
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = React.useState<string[] | null>(null);
  // A completed drop fires dragend right after drop; this keeps that from saving the same order twice.
  const droppedRef = React.useRef(false);

  const orderedIds = React.useMemo(() => {
    if (!pendingOrder) return ids;
    // Keep the local order only while it still covers exactly the cards being rendered.
    const idSet = new Set(ids);
    const covers =
      pendingOrder.length === ids.length && pendingOrder.every((id) => idSet.has(id));
    return covers ? pendingOrder : ids;
  }, [ids, pendingOrder]);

  // Once the server order matches what the user dragged, the local copy has nothing left to say.
  React.useEffect(() => {
    if (pendingOrder && sameOrder(pendingOrder, ids)) setPendingOrder(null);
  }, [ids, pendingOrder]);

  const getDragProps = React.useCallback(
    (characterId: string): CharacterDragProps => ({
      draggable: true,
      onDragStart: (event: React.DragEvent) => {
        droppedRef.current = false;
        setDraggingId(characterId);
        // Firefox only starts a drag when the payload is set, and "move" drops the copy cursor.
        event.dataTransfer.effectAllowed = 'move';
        try {
          event.dataTransfer.setData('text/plain', characterId);
        } catch {
          // Some browsers reject setData outside a user gesture; the drag still works without it.
        }
      },
      onDragEnter: (event: React.DragEvent) => {
        if (!draggingId || draggingId === characterId) return;
        event.preventDefault();
        setPendingOrder((prev) => moveBefore(prev ?? orderedIds, draggingId, characterId));
      },
      onDragOver: (event: React.DragEvent) => {
        if (!draggingId) return;
        // Without this the browser refuses the drop and animates the card back to its origin.
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      },
      onDrop: (event: React.DragEvent) => {
        if (!draggingId) return;
        event.preventDefault();
        const next =
          draggingId === characterId
            ? orderedIds
            : moveBefore(orderedIds, draggingId, characterId);
        droppedRef.current = true;
        setDraggingId(null);
        setPendingOrder(next);
        if (!sameOrder(next, ids)) onCommit(next);
      },
      onDragEnd: () => {
        setDraggingId(null);
        if (droppedRef.current) {
          droppedRef.current = false;
          return;
        }
        // A drag released outside the grid still leaves the preview order on screen, so save it.
        if (pendingOrder && !sameOrder(pendingOrder, ids)) onCommit(pendingOrder);
      },
    }),
    [draggingId, ids, onCommit, orderedIds, pendingOrder],
  );

  const clearPendingOrder = React.useCallback(() => setPendingOrder(null), []);

  return { orderedIds, draggingId, getDragProps, clearPendingOrder };
}
