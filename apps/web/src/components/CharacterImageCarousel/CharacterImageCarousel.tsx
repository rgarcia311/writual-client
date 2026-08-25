'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

/** Filled dot: the image on screen. */
const DOT_ACTIVE_COLOR = '#e7e4d1';
/** Hollow dots: the other images in the gallery. */
const DOT_INACTIVE_COLOR = 'rgba(231, 228, 209, 0.35)';
const DOT_BORDER_COLOR = 'rgba(0, 0, 0, 0.55)';

export interface CharacterImageCarouselProps {
  /** Portrait gallery in display order. Empty falls back to `fallbackSrc`. */
  images: string[];
  /** Shown when the gallery is empty. */
  fallbackSrc: string;
  alt: string;
  /** Applied to the frame so the page CSS can size the media region. */
  className?: string;
  /** Height of the media region when no CSS class governs it. */
  height: string;
}

/**
 * The portrait region of a character card: one image at a time, with arrows, dots and keyboard
 * left/right to move through the rest.
 *
 * Every control stops propagation because the card around it is both a drag handle for reordering
 * and, on some surfaces, clickable — paging through portraits must not start a drag or open the
 * character.
 */
export function CharacterImageCarousel({
  images,
  fallbackSrc,
  alt,
  className,
  height,
}: CharacterImageCarouselProps) {
  const gallery = React.useMemo(() => {
    const cleaned = images.filter((url) => typeof url === 'string' && url.trim());
    return cleaned.length ? cleaned : [fallbackSrc];
  }, [images, fallbackSrc]);

  const [index, setIndex] = React.useState(0);
  // Editing or deleting an image can leave the index past the end of the shorter gallery.
  const safeIndex = Math.min(index, gallery.length - 1);
  React.useEffect(() => {
    setIndex((current) => (current > gallery.length - 1 ? 0 : current));
  }, [gallery.length]);

  const multiple = gallery.length > 1;
  const step = (delta: number) =>
    setIndex((current) => {
      const next = (Math.min(current, gallery.length - 1) + delta) % gallery.length;
      return next < 0 ? next + gallery.length : next;
    });

  // A press that travels is a drag (reordering a card, moving a pane), not a click on the picture,
  // so the press origin is remembered and a click that moved is ignored.
  const pressOriginRef = React.useRef<{ x: number; y: number } | null>(null);
  const DRAG_SLOP_PX = 5;

  const handleImagePointerDown = (e: React.PointerEvent) => {
    pressOriginRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleImageClick = (e: React.MouseEvent) => {
    if (!multiple) return;
    const origin = pressOriginRef.current;
    pressOriginRef.current = null;
    if (
      origin &&
      (Math.abs(e.clientX - origin.x) > DRAG_SLOP_PX ||
        Math.abs(e.clientY - origin.y) > DRAG_SLOP_PX)
    ) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    step(1);
  };

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  // Pointer events fire ahead of mouse events, so a surface that drags on `pointerdown` (the
  // screenplay character pane) would start a drag the moment an arrow or dot is pressed. Only the
  // propagation is stopped here: preventing the default would suppress the click that follows.
  const stopBubble = (e: React.PointerEvent) => e.stopPropagation();

  const arrowSx = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 2,
    padding: '2px',
    color: '#fff',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.62)' },
  } as const;

  return (
    <Box
      className={className}
      // Focusable only when there is something to page through, so single-image cards keep the
      // card itself as the only tab stop.
      tabIndex={multiple ? 0 : undefined}
      role={multiple ? 'group' : undefined}
      aria-label={multiple ? `${alt} images` : undefined}
      onKeyDown={
        multiple
          ? (e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              stop(e);
              step(e.key === 'ArrowLeft' ? -1 : 1);
            }
          : undefined
      }
      sx={{
        position: 'relative',
        height,
        flexShrink: 0,
        overflow: 'hidden',
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
      }}
    >
      <Box
        component="img"
        src={gallery[safeIndex]}
        // Without this the browser drags the portrait itself instead of the card.
        draggable={false}
        alt={multiple ? `${alt} (${safeIndex + 1} of ${gallery.length})` : alt}
        onPointerDown={handleImagePointerDown}
        onClick={handleImageClick}
        sx={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          cursor: multiple ? 'pointer' : undefined,
        }}
      />

      {multiple && (
        <>
          <IconButton
            size="small"
            aria-label="Previous image"
            onClick={(e) => {
              stop(e);
              step(-1);
            }}
            onMouseDown={stop}
            onPointerDown={stopBubble}
            sx={{ ...arrowSx, left: 4 }}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Next image"
            onClick={(e) => {
              stop(e);
              step(1);
            }}
            onMouseDown={stop}
            onPointerDown={stopBubble}
            sx={{ ...arrowSx, right: 4 }}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </>
      )}

      {/*
        Dot strip: one dot per image, centered under the portrait, the filled one marking the image
        on screen. Always rendered, single image included — the dots are how a card says how many
        portraits a character has, so a lone dot is the honest answer rather than no answer at all.
        Clicking a dot moves straight to that image; the gallery is capped at six, so every dot fits
        without crowding.
      */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 0.75,
          py: 0.75,
        }}
      >
        {gallery.map((url, i) => (
          <Box
            key={`${url}-${i}`}
            component="button"
            type="button"
            aria-label={`Show image ${i + 1} of ${gallery.length}`}
            aria-current={i === safeIndex}
            disabled={!multiple}
            onClick={(e: React.MouseEvent) => {
              stop(e);
              setIndex(i);
            }}
            onMouseDown={stop}
            onPointerDown={stopBubble}
            sx={{
              cursor: multiple ? 'pointer' : 'default',
              width: 9,
              height: 9,
              padding: 0,
              borderRadius: '50%',
              border: `1px solid ${DOT_BORDER_COLOR}`,
              // Each dot carries its own contrast against a light or busy portrait, rather than a
              // scrim behind the whole strip.
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.55)',
              backgroundColor: i === safeIndex ? DOT_ACTIVE_COLOR : DOT_INACTIVE_COLOR,
              transition: 'background-color 120ms ease, transform 120ms ease',
              transform: i === safeIndex ? 'scale(1.15)' : 'none',
              '&:hover': { backgroundColor: DOT_ACTIVE_COLOR },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
