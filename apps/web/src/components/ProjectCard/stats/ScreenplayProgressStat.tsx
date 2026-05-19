'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { alpha, useTheme } from '@mui/material/styles';
import type { WritingTracker } from '@/interfaces/project';
import type { TrackerScheduleStatus, WritingTrackerStatus } from '../../../utils/progress';
import {
  formatWritingTrackerDueDateIso,
  formatWritingTrackerRelativeDeadlineShort,
} from '../../../utils/progress';
import { estimateWeekWritingBarRatios } from '../../../utils/projectScreenplayStats';

const TRACKER_STATUS_LABEL: Record<string, string> = {
  ahead: 'Ahead',
  on_track: 'On Track',
  behind: 'Behind',
  no_data: '—',
};

/** Y-axis scale for the week bar chart (labels and bar normalization). */
const CHART_Y_MAX = 150;
const CHART_Y_TICKS = [0, 50, 100, 150] as const;

interface ScreenplayProgressStatProps {
  status: WritingTrackerStatus;
  tracker: WritingTracker;
  /** Compact layout for fixed-height stat tiles */
  compact?: boolean;
}

export function ScreenplayProgressStat({ status, tracker, compact = false }: ScreenplayProgressStatProps) {
  const theme = useTheme();
  const pct = status.pageProgressPercent ?? 0;
  const current = status.resolvedCurrentPages;
  const target = tracker.targetPageCount ?? 0;
  const labelInFillMinPct = 18;

  const bars = React.useMemo(
    () => estimateWeekWritingBarRatios(new Date(), status.pagesPerDay),
    [status.pagesPerDay],
  );

  const axisTicks = CHART_Y_TICKS;

  const trackBg = alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.14 : 0.08);
  const fillMain = theme.palette.success.main;
  const projectedBarsBg = alpha(
    theme.palette.text.primary,
    theme.palette.mode === 'dark' ? 0.24 : 0.14,
  );
  const barActive = fillMain;
  const gridLine = alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.55 : 0.65);

  const statusWordColor = (s: TrackerScheduleStatus): string => {
    if (s === 'ahead') return theme.palette.success.main;
    if (s === 'on_track') return theme.palette.warning.main;
    if (s === 'behind') return theme.palette.error.main;
    return theme.palette.text.disabled;
  };

  const statusDotColor = (s: TrackerScheduleStatus): string => {
    if (s === 'ahead') return theme.palette.success.main;
    if (s === 'on_track') return theme.palette.warning.main;
    if (s === 'behind') return theme.palette.error.main;
    return alpha(theme.palette.text.primary, 0.28);
  };

  const stackGap = compact ? 0.35 : 1;
  const axisW = compact ? 22 : 28;
  const tickFontSize = compact ? '0.55rem' : '0.65rem';

  const progressLabel =
    target > 0 ? `${current} / ${target} Pages (${pct}%)` : `${current} / ? Pages`;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        height: '100%',
        minWidth: 0,
        gap: stackGap,
      }}
    >
      {/* Top: header + chart; slightly shorter than half card height */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          height: 'calc(50% - 5px)',
          minHeight: 0,
          minWidth: 0,
          gap: compact ? 0.25 : 0.4,
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, fontSize: compact ? '0.8rem' : undefined, mb: '5px' }}
        >
          Screenplay Progress
        </Typography>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              flex: 1,
              minHeight: 0,
              minWidth: 0,
            }}
          >
          <Box
            sx={{
              width: axisW,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              pr: 0.25,
              py: compact ? 0.15 : 0.25,
            }}
            aria-hidden
          >
            {[...axisTicks].reverse().map((t) => (
              <Typography
                key={`tick-${t}`}
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: tickFontSize, lineHeight: 1.1 }}
              >
                {t}
              </Typography>
            ))}
          </Box>

          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              alignSelf: 'stretch',
              position: 'relative',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 0,
                pointerEvents: 'none',
              }}
            >
              {axisTicks
                .filter((t) => t > 0)
                .map((t) => (
                  <Box
                    key={`grid-${t}`}
                    sx={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: `${(1 - t / CHART_Y_MAX) * 100}%`,
                      borderTop: `1px solid ${gridLine}`,
                    }}
                  />
                ))}
            </Box>

            <Box
              sx={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: compact ? 0.25 : 0.5,
                height: '100%',
                px: compact ? 0.35 : 0.5,
                pb: 0,
                pt: compact ? 0.35 : 0.5,
              }}
            >
              {bars.map((row) => {
                const pairColor = row.projected ? projectedBarsBg : barActive;
                return (
                  <Box
                    key={row.label}
                    sx={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minWidth: 0,
                      minHeight: 0,
                      height: '100%',
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        gap: compact ? 0.15 : 0.3,
                      }}
                    >
                      <Box
                        sx={{
                          width: '42%',
                          height: `${Math.min(100, Math.max(4, (row.draft / CHART_Y_MAX) * 100))}%`,
                          maxHeight: '100%',
                          borderRadius: 0.5,
                          bgcolor: pairColor,
                          transition: 'height 0.25s ease',
                        }}
                        aria-label={`${row.label} draft output (estimated)`}
                      />
                      <Box
                        sx={{
                          width: '42%',
                          height: `${Math.min(100, Math.max(4, (row.pace / CHART_Y_MAX) * 100))}%`,
                          maxHeight: '100%',
                          borderRadius: 0.5,
                          bgcolor: pairColor,
                          transition: 'height 0.25s ease',
                        }}
                        aria-label={`${row.label} pace benchmark (estimated)`}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-start',
              flexShrink: 0,
              borderTop: `1px solid ${gridLine}`,
              pt: compact ? 0.2 : 0.35,
            }}
          >
            <Box sx={{ width: axisW, flexShrink: 0 }} aria-hidden />
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: compact ? 0.25 : 0.5,
                minWidth: 0,
                px: compact ? 0.35 : 0.5,
              }}
            >
              {bars.map((row) => (
                <Typography
                  key={`x-${row.label}`}
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    flex: 1,
                    fontSize: compact ? '0.52rem' : '0.62rem',
                    fontWeight: 600,
                    textAlign: 'center',
                    lineHeight: 1.1,
                    minWidth: 0,
                  }}
                >
                  {row.label}
                </Typography>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Bottom half: progress, status, deadline */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          flexBasis: 0,
          minHeight: 0,
          minWidth: 0,
          justifyContent: 'center',
          gap: stackGap,
        }}
      >
        {/* Main progress */}
        <Box
          sx={{
            position: 'relative',
            flexShrink: 0,
            height: compact ? theme.spacing(3.75) : theme.spacing(5),
            borderRadius: 2,
            bgcolor: trackBg,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${pct}%`,
              bgcolor: fillMain,
              borderRadius: 2,
              zIndex: 0,
            }}
          />
          {pct >= labelInFillMinPct ? (
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${pct}%`,
                px: compact ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: compact ? '0.62rem' : undefined,
                color: theme.palette.success.contrastText,
                textShadow: `0 1px 2px ${alpha(theme.palette.common.black, 0.35)}`,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                zIndex: 1,
              }}
            >
              {progressLabel}
            </Typography>
          ) : (
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                inset: 0,
                px: compact ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: compact ? '0.62rem' : undefined,
                color: theme.palette.getContrastText(trackBg),
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                zIndex: 1,
              }}
            >
              {progressLabel}
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: compact ? 0.35 : 0.5,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.45, color: 'text.secondary' }}>
            <HourglassEmptyIcon sx={{ fontSize: compact ? 14 : 18 }} aria-hidden />
            <Typography variant="caption" sx={{ fontSize: compact ? '0.62rem' : undefined }}>
              <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {status.pagesPerDay != null ? `${status.pagesPerDay} pg/day` : '—'}
              </Box>
            </Typography>
          </Box>
          <Box
            sx={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              flexShrink: 0,
              bgcolor: statusDotColor(status.scheduleStatus),
            }}
            aria-hidden
          />
          <Typography
            variant="caption"
            component="span"
            sx={{ fontWeight: 700, fontSize: compact ? '0.62rem' : undefined, color: 'text.primary' }}
          >
            Status:{' '}
          </Typography>
          {status.scheduleStatus !== 'no_data' ? (
            <Typography
              variant="caption"
              component="span"
              sx={{
                fontWeight: 600,
                fontSize: compact ? '0.62rem' : undefined,
                color: statusWordColor(status.scheduleStatus),
              }}
            >
              {TRACKER_STATUS_LABEL[status.scheduleStatus]}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">
              —
            </Typography>
          )}
        </Box>

        {status.nextDueDraftLabel &&
          status.nextDueDraftDate &&
          status.daysUntilNextDue != null && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                color: 'text.secondary',
                flexWrap: 'wrap',
              }}
            >
              <CalendarTodayIcon sx={{ fontSize: compact ? '0.9rem' : undefined }} aria-hidden />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: compact ? '0.6rem' : undefined, lineHeight: compact ? 1.2 : undefined }}
              >
                {status.nextDueDraftLabel}{' '}
                {formatWritingTrackerRelativeDeadlineShort(status.daysUntilNextDue)} (
                {formatWritingTrackerDueDateIso(status.nextDueDraftDate)})
              </Typography>
            </Box>
          )}
      </Box>
    </Box>
  );
}
