import * as React from 'react';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { Box, IconButton as MuiIconButton, Tooltip } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { VersionSelectorWithAdd } from '@/components/VersionSelectorWithAdd/VersionSelectorWithAdd';
import { CharacterImageCarousel } from '@/components/CharacterImageCarousel';
import { useSpatialHoverLift } from '@/hooks/useSpatialHoverLift';

const DEFAULT_CHARACTER_IMAGE = '/default-character-image.png';

/** Maps a raw gender string to M / F / X, or '' when absent. */
function abbreviateGender(gender: unknown): string {
  if (!gender || typeof gender !== 'string') return '';
  const lower = gender.trim().toLowerCase();
  if (lower === 'male' || lower === 'm') return 'M';
  if (lower === 'female' || lower === 'f') return 'F';
  if (lower === '') return '';
  return 'X';
}

interface CharacterCardProps {
  name?: string;
  details?: any[];
  id: number;
  imageUrl?: string;
  /**
   * Full portrait gallery in display order. When it holds more than one image the card's portrait
   * region becomes a carousel; falls back to `imageUrl` when absent.
   */
  imageUrls?: string[];
  /**
   * Non-grid cards grow to fit their details when true. Grid tiles keep their fixed height and
   * scroll instead, so the Characters page leaves this alone.
   */
  expanded?: boolean;
  /** When true, version selector and add version are disabled */
  locked?: boolean;
  /** Called when user requests to add a new character version */
  onAddVersion?: () => void;
  /** Called when user toggles the locked state */
  onToggleLock?: () => void;
  /** Called when user clicks the edit icon; receives the currently displayed version's details. */
  onEditClick?: (detail: Record<string, unknown> | undefined) => void;
  /**
   * Called when user clicks the delete icon. The icon only renders when this is provided, so
   * read-only surfaces (screenplay panes, locked sections) simply omit it.
   */
  onDeleteClick?: () => void;
  /**
   * Narrow parents (e.g. screenplay side panel): full width, no grid percentage width.
   */
  fullWidthInParent?: boolean;
  /** Characters page grid: fixed 305×385px tile via CSS vars. */
  gridTile?: boolean;
  /**
   * Drag handlers from `useCharacterReorder`, spread onto the card root so the whole tile is the
   * drag handle. Omitted on surfaces where cards are not reorderable (screenplay panes).
   */
  dragProps?: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean };
  /** True while this card is the one being dragged; dims it so the drop preview reads clearly. */
  dragging?: boolean;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  name,
  details,
  id,
  imageUrl,
  imageUrls,
  expanded = false,
  locked = false,
  onAddVersion,
  onToggleLock,
  onEditClick,
  onDeleteClick,
  fullWidthInParent = false,
  gridTile = false,
  dragProps,
  dragging = false,
}) => {
  const detailCount = Array.isArray(details) ? Math.max(1, details.length) : 1;
  const { hoverHandlers, xrStyle } = useSpatialHoverLift(8, 24);
  const [version, setVersion] = React.useState(1);
  const versionOptions = React.useMemo(
    () => Array.from({ length: detailCount }, (_, i) => i + 1),
    [detailCount]
  );

  const detail = details?.find((d: any) => d.version === version)

  // Characters saved before multi-image support carry only `imageUrl`, so it stands in as a
  // one-image gallery.
  const gallery = React.useMemo(() => {
    const list = (imageUrls ?? []).filter((url) => typeof url === 'string' && url.trim());
    if (list.length) return list;
    return imageUrl?.trim() ? [imageUrl] : [];
  }, [imageUrls, imageUrl]);

  return (
      <Card
        enable-xr
        className={[
          gridTile ? 'character-card--grid' : null,
          dragProps ? 'character-card--draggable' : null,
          dragging ? 'character-card--dragging' : null,
        ]
          .filter(Boolean)
          .join(' ') || undefined}
        {...hoverHandlers}
        {...dragProps}
        style={xrStyle}
        sx={{
          // <PROTECTED> — character card dimensions; see .cursor/rules/character-card-dimensions.mdc
          ...(gridTile
            ? {
                width: 'var(--character-card-width, 305px)',
                maxWidth: 'var(--character-card-width, 305px)',
                height: 'var(--character-card-height, 390px)',
                maxHeight: 'var(--character-card-height, 390px)',
                flex: '0 0 auto',
              }
            : {
                width: fullWidthInParent ? '100%' : 'calc(20% - 8px)',
                maxWidth: fullWidthInParent ? '100%' : 'none',
                height: expanded ? 'auto' : 'var(--character-card-height, 390px)',
                maxHeight: expanded ? 'none' : 'var(--character-card-height, 390px)',
              }),
          // </PROTECTED>
          borderRadius: 'var(--project-float-radius, 12px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/*
          Tool bar: its own opaque strip across the top of the card, with the portrait running
          underneath it, so the controls stay readable over a light or busy uploaded image.
        */}
        <Box
          className="character-card__tools"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            minHeight: 'var(--character-card-tools-height, 40px)',
            px: 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--character-card-tools-bg, #e7e4d1)',
            // The bar is a fixed light strip in both themes, so its icons are pinned dark rather
            // than following the palette's text color.
            color: 'rgba(0, 0, 0, 0.72)',
            zIndex: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title={locked ? 'Unlock character' : 'Lock character'}>
              <MuiIconButton
                size="small"
                color="inherit"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLock?.();
                }}
              >
                {locked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
              </MuiIconButton>
            </Tooltip>
            <Tooltip title="Edit character">
              <MuiIconButton
                size="small"
                color="inherit"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditClick?.(detail);
                }}
              >
                <EditIcon fontSize="small" />
              </MuiIconButton>
            </Tooltip>
            {onDeleteClick && (
              <Tooltip title={locked ? 'Unlock character to delete' : 'Delete character'}>
                {/* Span keeps the tooltip working while the button is disabled. */}
                <span>
                  <MuiIconButton
                    size="small"
                    color="inherit"
                    disabled={locked}
                    aria-label="Delete character"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClick();
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </MuiIconButton>
                </span>
              </Tooltip>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <VersionSelectorWithAdd
              value={String(version)}
              versionOptions={versionOptions}
              onVersionChange={setVersion}
              onAddVersion={() => onAddVersion?.()}
              disabled={locked}
              addVersionAriaLabel="Add new character version"
            />
          </Box>
        </Box>
        <CharacterImageCarousel
          images={gallery}
          fallbackSrc={DEFAULT_CHARACTER_IMAGE}
          alt={name ? `${name} character` : 'Character'}
          className={gridTile ? 'character-card__media' : undefined}
          height={gridTile ? 'var(--character-card-media-height, 240px)' : '300px'}
        />
          <CardHeader
            title={detail ? `${name ?? ''} ${detail.age ?? ''} ${abbreviateGender(detail.gender)}`.trim() : name}
            titleTypographyProps={{ noWrap: true }}
          />

        {/* Details always show; the card's own CardContent scroll handles bios longer than the tile. */}
        {detail && (
            <CardContent>
              <Typography paragraph>Character Details:</Typography>
              <Box sx={{ maxWidth: "300px"}}>
                <Typography paragraph>{detail.bio}</Typography>
                <Typography>Want: {detail.want}</Typography>
                <Typography>Need: {detail.need}</Typography>
              </Box>
            </CardContent>
          )}

      </Card>

  );
}
