// Navbar superior de la pagina

import React from 'react';
import { AppBar, Toolbar, Typography, InputBase, IconButton, Badge, Box, styled, alpha } from '@mui/material';
import {
  Search as SearchIcon,
  Mic as MicIcon,
  Bookmark as BookmarkIcon,
  AccountCircle as AccountIcon,
  ShoppingCart as ShoppingCartIcon
} from '@mui/icons-material';

const SearchBar = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: '24px',
  backgroundColor: alpha(theme.palette.common.white, 0.2),
  '&:hover': { backgroundColor: alpha(theme.palette.common.white, 0.3) },
  marginRight: theme.spacing(2),
  marginLeft: theme.spacing(3),
  width: '100%',
  maxWidth: '500px',
  display: 'flex',
  alignItems: 'center',
  padding: '4px 12px',
}));

export default function Navbar({
  cartCount,
  logoPath,
  onOpenCart,
  onOpenLogin,
  onOpenProfile,
  user,
  onShowToast
}) {

  const handleUserIconClick = () => {
    if (!user) {
      if (onShowToast) {
        onShowToast('Debes iniciar sesión para acceder a tu cuenta', 'warning');
      }
      if (onOpenLogin) {
        onOpenLogin();
      }
    } else {
      if (onOpenProfile) {
        onOpenProfile();
      }
    }
  };

  return (
    <AppBar position="sticky" sx={{ backgroundColor: '#1e3a5f', boxShadow: 2 }}>
      <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 4 } }}>
        
        {/* Logotipo personalizado */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}>
          {logoPath ? (
            <Box component="img" src={logoPath} alt="Logo" sx={{ height: 40, width: 'auto' }} />
          ) : null}
          <Typography variant="h6" noWrap sx={{ fontWeight: 700, letterSpacing: 0.5, color: '#ffffff' }}>
            Navegante de Páginas
          </Typography>
        </Box>

        {/* Buscador estilo e-commerce */}
        <SearchBar>
          <SearchIcon sx={{ color: 'white', mr: 1 }} />
          <InputBase
            placeholder="Buscar por título, autor o ISBN..."
            sx={{ color: 'white', flex: 1, fontSize: '0.95rem' }}
          />
          <IconButton size="small" sx={{ color: 'white' }}>
            <MicIcon fontSize="small" />
          </IconButton>
        </SearchBar>

        {/* Accesos de Usuario */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton color="inherit">
            <BookmarkIcon />
          </IconButton>
          
          {/* Icono de Usuario autenticado / inicio de sesión */}
          <IconButton color="inherit" onClick={handleUserIconClick}>
            <AccountIcon fontSize="large" />
          </IconButton>
          
          {/* Botón del carrito */}
          <IconButton color="inherit" onClick={onOpenCart}>
            <Badge badgeContent={cartCount} color="error">
              <ShoppingCartIcon fontSize="large" />
            </Badge>
          </IconButton>
        </Box>

      </Toolbar>
    </AppBar>
  );
}