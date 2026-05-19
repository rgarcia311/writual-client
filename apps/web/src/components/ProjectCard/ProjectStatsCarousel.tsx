'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTheme } from '@mui/material/styles';

export interface ProjectStatsCarouselProps {
  children: React.ReactNode;
  /** How many stat cards are visible at once (default 3). */
  visibleCount?: number;
}

export function ProjectStatsCarousel({ children, visibleCount = 3 }: ProjectStatsCarouselProps) {
  const theme = useTheme();
  const slides = React.Children.toArray(children).filter(Boolean);
  const slideCount = slides.length;
  const maxStart = Math.max(0, slideCount - visibleCount);

  const [startIndex, setStartIndex] = React.useState(0);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [cardStepPx, setCardStepPx] = React.useState(0);

  React.useEffect(() => {
    setStartIndex((s) => Math.min(s, maxStart));
  }, [maxStart]);

  const gapPx = React.useMemo(() => {
    const raw = theme.spacing(1);
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
    return Number.isFinite(n) ? n : 8;
  }, [theme]);

  React.useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el || slideCount === 0) return;

    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w <= 0) return;
      const cardW = (w - (visibleCount - 1) * gapPx) / visibleCount;
      setCardStepPx(cardW + gapPx);
    };

    measure();
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [gapPx, slideCount, visibleCount]);

  const goPrev = React.useCallback(() => {
    setStartIndex((s) => Math.max(0, s - 1));
  }, []);

  const goNext = React.useCallback(() => {
    setStartIndex((s) => Math.min(maxStart, s + 1));
  }, [maxStart]);

  const onDotClick = React.useCallback(
    (i: number) => {
      setStartIndex(Math.min(Math.max(0, i - 1), maxStart));
    },
    [maxStart],
  );

  if (slideCount === 0) return null;

  const translateX = cardStepPx > 0 ? -startIndex * cardStepPx : 0;
  const atStart = startIndex <= 0;
  const atEnd = startIndex >= maxStart;

  return (
    <Box
      role="region"
      aria-roledescription="carousel"
      aria-label="Project statistics"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        height: 'var(--project-stats-height)',
        maxHeight: 'var(--project-stats-height)',
        minWidth: 0,
        flex: { xs: '0 0 auto', lg: '1 1 auto' },
        width: '100%',
        maxWidth: '100%',
        alignSelf: 'stretch',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 0.5,
          flex: 1,
          minHeight: 0,
          width: '100%',
        }}
      >
        <IconButton
          aria-label="Previous statistics"
          size="small"
          onClick={goPrev}
          disabled={atStart}
          sx={{ alignSelf: 'center', flexShrink: 0 }}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>

        <Box
          ref={viewportRef}
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',
              gap: `${gapPx}px`,
              height: '100%',
              minHeight: 0,
              transform: `translateX(${translateX}px)`,
              transition: theme.transitions.create('transform', {
                duration: theme.transitions.duration.shortest,
                easing: theme.transitions.easing.easeOut,
              }),
              willChange: 'transform',
            }}
          >
            {slides.map((slide, i) => (
              <Box
                key={i}
                sx={{
                  flexShrink: 0,
                  height: '100%',
                  minHeight: 0,
                  minWidth: cardStepPx > 0 ? 0 : 96,
                  width:
                    cardStepPx > 0
                      ? `${cardStepPx - gapPx}px`
                      : `calc((100% - ${(visibleCount - 1) * gapPx}px) / ${visibleCount})`,
                }}
              >
                {slide}
              </Box>
            ))}
          </Box>
        </Box>

        <IconButton
          aria-label="Next statistics"
          size="small"
          onClick={goNext}
          disabled={atEnd}
          sx={{ alignSelf: 'center', flexShrink: 0 }}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 0.75,
          flexShrink: 0,
        }}
      >
        {slides.map((_, i) => {
          const inView =
            maxStart === 0 ? true : i >= startIndex && i < startIndex + visibleCount;
          return (
            <Box
              key={i}
              component="button"
              type="button"
              onClick={() => onDotClick(i)}
              aria-label={`Focus stat ${i + 1} of ${slideCount}`}
              aria-current={i === startIndex ? 'true' : undefined}
              sx={{
                p: 0,
                border: 'none',
                cursor: 'pointer',
                width: inView ? 10 : 8,
                height: inView ? 10 : 8,
                borderRadius: '50%',
                bgcolor: inView ? 'primary.main' : 'action.disabledBackground',
                opacity: inView ? 1 : 0.55,
                transition: theme.transitions.create(['width', 'height', 'opacity', 'background-color'], {
                  duration: theme.transitions.duration.shortest,
                }),
                '&:hover': { opacity: 1 },
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
