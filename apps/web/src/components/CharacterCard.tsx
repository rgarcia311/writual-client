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
import { Box } from '@mui/material';
import { useEffect } from 'react';

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

export const CharacterCard: React.FC<any> = ({name, details, id, imageUrl}) => {
  const [expanded, setExpanded] = React.useState(false);
  const [version, setVersion] = React.useState(1)
  const [ currentId,  setCurrentId ] =  React.useState<number  | undefined>()

  useEffect(() => {
    if(!expanded)  {
      setCurrentId(undefined)
    }
  }, [expanded])

  const handleExpandClick = () => {
      setExpanded(!expanded);
  }

  const detail = details?.find((d: any) => d.version === version)
  if (detail) {
    detail.url = "https://www.broadwayworld.com/ezoimgfmt/cloudimages.broadwayworld.com/headshots/452956sm.jpg?dt=42352886&ezimgfmt=ng%3Awebp%2Fngcb36%2Frs%3Adevice%2Frscb37-2"
  }

  const imageSrc = imageUrl?.trim() ? imageUrl : DEFAULT_CHARACTER_IMAGE;

  return (
  
      <Card sx={{ maxWidth: 345, maxHeight: currentId === id ? "max-content" : "375px"  }}>
        <CardMedia
          component="img"
          height="300"
          image={imageSrc}
          alt={name ? `${name} character` : 'Character'}
        />
          <CardHeader
            action={
              <>
                <ExpandMore
                  expand={expanded}
                  onClick={() => { setCurrentId(id); handleExpandClick()}}
                  aria-expanded={expanded}
                  aria-label="show more">
                  <ExpandMoreIcon />
                </ExpandMore>
               
              </>
              
            }
            title={detail ? `${name ?? ''} ${detail.age ?? ''} ${detail.gender ?? ''}`.trim() : name}
            subheader={detail ? `Version: ${detail.version}` : undefined}
          />

        {
          currentId === id && detail && (
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
            
          )

        }

      </Card>

  );
}
