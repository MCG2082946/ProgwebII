import { Box, Container, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { storePages } from './StoreInformation';

export default function Footer() {
  return <Box component="footer" sx={{ bgcolor: '#1e3a5f', color: 'white', py: 4, mt: 'auto' }}>
    <Container maxWidth="xl" sx={{ textAlign: 'center' }}>
      <Stack component="nav" aria-label="Información de la tienda" direction="row" useFlexGap
        sx={{ justifyContent: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        {Object.entries(storePages).map(([path, page]) =>
          <Link key={path} component={RouterLink} to={'/informacion/' + path} color="inherit" underline="hover">
            {page.title}
          </Link>)}
      </Stack>
      <Typography variant="body2" sx={{ color: '#e2e8f0' }}>Navegante de Páginas</Typography>
    </Container>
  </Box>;
}
