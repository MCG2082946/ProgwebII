import { AppBar, Toolbar, Typography, IconButton, Badge, Box } from '@mui/material';
import { AccountCircle, ShoppingCart } from '@mui/icons-material';
import { Link } from 'react-router-dom';

export default function Navbar({ cartCount, logoPath, onOpenCart, onOpenLogin, onOpenProfile, user }) {
  return (
    <AppBar position="sticky" sx={{ backgroundColor: '#1e3a5f', boxShadow: 2 }}>
      <Toolbar sx={{ justifyContent: 'space-between', gap: 1, px: { xs: 1.5, md: 4 } }}>
        <Box component={Link} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'inherit', textDecoration: 'none', minWidth: 0 }}>
          <Box component="img" src={logoPath} alt="" sx={{ height: { xs: 32, sm: 40 }, width: 'auto' }} />
          <Typography sx={{ fontSize: { xs: '0.95rem', sm: '1.25rem' }, fontWeight: 700, lineHeight: 1.2 }}>
            Navegante de Páginas
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexShrink: 0 }}>
          <IconButton color="inherit" onClick={user ? onOpenProfile : onOpenLogin} aria-label={user ? 'Mi cuenta' : 'Iniciar sesión'}>
            <AccountCircle fontSize="large" />
          </IconButton>
          <IconButton color="inherit" onClick={onOpenCart} aria-label="Carrito">
            <Badge badgeContent={cartCount} color="error"><ShoppingCart fontSize="large" /></Badge>
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
