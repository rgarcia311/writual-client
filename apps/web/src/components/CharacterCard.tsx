import * as React from 'react';
import { styled } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
import Collapse from '@mui/material/Collapse';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, IconButton as MuiIconButton, Tooltip } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { VersionSelectorWithAdd } from '@/components/VersionSelectorWithAdd/VersionSelectorWithAdd';
import { useSpatialHoverLift } from '@/hooks/useSpatialHoverLift';

interface ExpandMoreProps extends IconButtonProps {
  expand: boolean;
}

const ExpandMore = styled((props: ExpandMoreProps) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? 'rotate(0deg)' : 'rotate(180deg)',
  marginLeft: 'auto',
  transition: theme.transitions.create('transform', {
    duration: theme.transitions.duration.shortest,
  }),
}));

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
  /** Whether this card is the one currently expanded (only one card expanded at a time) */
  expanded?: boolean;
  /** Called when the expand/collapse icon is clicked */
  onExpandClick?: () => void;
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
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  name,
  details,
  id,
  imageUrl,
  expanded = false,
  onExpandClick,
  locked = false,
  onAddVersion,
  onToggleLock,
  onEditClick,
  onDeleteClick,
  fullWidthInParent = false,
  gridTile = false,
}) => {
  const detailCount = Array.isArray(details) ? Math.max(1, details.length) : 1;
  const { hoverHandlers, xrStyle } = useSpatialHoverLift(8, 24);
  const [version, setVersion] = React.useState(1);
  const versionOptions = React.useMemo(
    () => Array.from({ length: detailCount }, (_, i) => i + 1),
    [detailCount]
  );

  const detail = details?.find((d: any) => d.version === version)

  const imageSrc = imageUrl?.trim() ? imageUrl : DEFAULT_CHARACTER_IMAGE;

  return (
      <Card
        enable-xr
        className={gridTile ? 'character-card--grid' : undefined}
        {...hoverHandlers}
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
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', pointerEvents: 'auto' }}>
            <Tooltip title={locked ? 'Unlock character' : 'Lock character'}>
              <MuiIconButton
                size="small"
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
          <Box sx={{ pointerEvents: 'auto' }}>
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
        <CardMedia
          component="img"
          image={imageSrc}
          alt={name ? `${name} character` : 'Character'}
          className={gridTile ? 'character-card__media' : undefined}
          sx={{
            height: gridTile ? 'var(--character-card-media-height, 240px)' : '300px',
            flexShrink: 0,
            objectFit: 'cover',
          }}
        />
          <CardHeader
            action={
              <ExpandMore
                expand={expanded}
                onClick={onExpandClick}
                aria-expanded={expanded}
                aria-label="show more"
              >
                <ExpandMoreIcon />
              </ExpandMore>
            }
            title={detail ? `${name ?? ''} ${detail.age ?? ''} ${abbreviateGender(detail.gender)}`.trim() : name}
            subheader={detail ? `Version: ${detail.version}` : undefined}
            titleTypographyProps={{ noWrap: true }}
          />

        {expanded && detail && (
            <CardContent>
              <Collapse in={expanded} timeout="auto" unmountOnExit>
                <Typography paragraph>Character Details:</Typography>
                <Box sx={{ maxWidth: "300px"}}>
                  <Typography paragraph>{detail.bio}</Typography>
                  <Typography>Want: {detail.want}</Typography>
                  <Typography>Need: {detail.need}</Typography>
                </Box>
            </Collapse>
            </CardContent>
          )}

      </Card>

  );
}
