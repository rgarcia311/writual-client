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
import { VersionSelectorWithAdd } from '@/components/VersionSelectorWithAdd/VersionSelectorWithAdd';

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
}) => {
  const detailCount = Array.isArray(details) ? Math.max(1, details.length) : 1;
  const [version, setVersion] = React.useState(1);
  const versionOptions = React.useMemo(
    () => Array.from({ length: detailCount }, (_, i) => i + 1),
    [detailCount]
  );

  const detail = details?.find((d: any) => d.version === version)

  const imageSrc = imageUrl?.trim() ? imageUrl : DEFAULT_CHARACTER_IMAGE;

  return (
      <Card
        sx={{
          width: 'calc(20% - 8px)',
          maxHeight: 'max-content',
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
          <Tooltip title={locked ? 'Unlock character' : 'Lock character'}>
            <MuiIconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock?.();
              }}
              sx={{ pointerEvents: 'auto' }}
            >
              {locked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
            </MuiIconButton>
          </Tooltip>
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
          sx={{
            height: '300px',
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
            title={detail ? `${name ?? ''} ${detail.age ?? ''} ${detail.gender ?? ''}`.trim() : name}
            subheader={detail ? `Version: ${detail.version}` : undefined}
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
