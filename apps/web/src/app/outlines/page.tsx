import { Container, Typography } from '@mui/material';
import { OutlinesContent } from '@/components/OutlinesContent/OutlinesContent';

export default function OutlinesPage() {
  return (
    <Container maxWidth={false} disableGutters sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%', p: 2 }}>
      <Container
        disableGutters
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          height: 70,
          marginTop: '10px',
          textAlign: 'center',
        }}
      >
        <Typography
          fontFamily="Merriweather"
          letterSpacing={5}
          fontSize={28}
          fontWeight={700}
          color="primary"
        >
          Outlines
        </Typography>
      </Container>
      <OutlinesContent />
    </Container>
  );
}
