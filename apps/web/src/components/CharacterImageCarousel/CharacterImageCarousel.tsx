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

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

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
        sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
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
            sx={{ ...arrowSx, right: 4 }}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>

          {/*
            Dot strip: one dot per image, centered under the portrait, the filled one marking the
            image on screen. Clicking a dot moves straight to that image; the gallery is capped at
            six, so every dot fits without crowding.
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
              // Dots have to read over a light or busy portrait, so they sit on their own scrim.
              background: 'linear-gradient(to top, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0))',
            }}
          >
            {gallery.map((url, i) => (
              <Box
                key={`${url}-${i}`}
                component="button"
                type="button"
                aria-label={`Show image ${i + 1} of ${gallery.length}`}
                aria-current={i === safeIndex}
                onClick={(e: React.MouseEvent) => {
                  stop(e);
                  setIndex(i);
                }}
                onMouseDown={stop}
                sx={{
                  cursor: 'pointer',
                  width: 9,
                  height: 9,
                  padding: 0,
                  borderRadius: '50%',
                  border: `1px solid ${DOT_BORDER_COLOR}`,
                  backgroundColor: i === safeIndex ? DOT_ACTIVE_COLOR : DOT_INACTIVE_COLOR,
                  transition: 'background-color 120ms ease, transform 120ms ease',
                  transform: i === safeIndex ? 'scale(1.15)' : 'none',
                  '&:hover': { backgroundColor: DOT_ACTIVE_COLOR },
                }}
              />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
