// Modal de carrito de compras

import React, { useState } from 'react';
import CheckoutDialog from './CheckoutDialog';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Card,
  CardMedia,
  CardContent,
  Divider,
  Alert,
  Paper
} from '@mui/material';
import {
  Close as CloseIcon,
  FavoriteBorder as FavoriteIcon,
  Favorite as SavedFavoriteIcon,
  DeleteOutlineOutlined as DeleteIcon, 
  Add as AddIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';

export default function CartDrawer({ open, onClose, cartItems, onUpdateQuantity, onRemoveItem,
  totalPrice, loading = false, busy = false, error = '', onRetry, authenticated = false, onCheckout, favorites, onFavorite, onViewOrders }) {
  const [summary, setSummary] = useState(false);
  const canBuy = authenticated && cartItems.length > 0 && cartItems.every((item) => item.available) && !loading && !busy && !error;
  const totalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 420 }, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }
      }}
    >
      <Box role="region" aria-label="Carrito de compras" sx={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
        
        {/* Encabezado */}
        <Box sx={{ backgroundColor: '#4a7c9f', color: 'white', py: 2, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
            Productos seleccionados
          </Typography>
          <IconButton aria-label="Cerrar carrito" onClick={onClose} sx={{ color: 'white', p: 0.5 }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Lista de Libros */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!authenticated && <Alert severity="info">Inicia sesión para agregar libros y consultar tu carrito.</Alert>}
          {loading && <Typography role="status">Cargando carrito...</Typography>}
          {busy && <Typography role="status">Guardando carrito...</Typography>}
          {error && <Alert severity="error" action={<Button disabled={loading || busy} onClick={onRetry}>Reintentar</Button>}>{error}</Alert>}
          {favorites?.error && <Alert severity="error" action={<Button disabled={favorites.loading || favorites.busy} onClick={favorites.reload}>Reintentar favoritos</Button>}>{favorites.error}</Alert>}
          {!loading && !error && cartItems.length === 0 ? (
            <Typography sx={{ textAlign: 'center', color: '#64748b', mt: 4 }}>
              Tu carrito está vacío.
            </Typography>
          ) : (
            cartItems.map((item) => (
              <Card key={item.id} elevation={0} sx={{ display: 'flex', p: 1.5, border: '1px solid #f1f5f9', borderRadius: 2, backgroundColor: '#fafafa' }}>
                <CardMedia
                  component="img"
                  image={item.cover}
                  alt={item.title}
                  sx={{ width: 80, height: 110, objectFit: 'cover', borderRadius: 1 }}
                />
                <CardContent sx={{ flex: 1, p: '4px 12px !important', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2, color: '#334155', fontSize: '0.85rem' }}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                      {item.author}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#1e3a5f', fontWeight: 700, display: 'block', mt: 0.5 }}>
                      ${item.price.toFixed(2)} c/u
                    </Typography>
                    {!item.available && <Typography role="status" variant="caption" color="error">{item.reason} No se incluye en el total.</Typography>}
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton aria-label={(favorites?.has(item.id) ? 'Quitar de favoritos ' : 'Guardar en favoritos ') + item.title}
                        aria-pressed={favorites?.has(item.id) || false}
                        disabled={!onFavorite || favorites?.loading || favorites?.busy || !!favorites?.error}
                        onClick={() => onFavorite(item)} size="small" sx={{ color: favorites?.has(item.id) ? '#1e3a5f' : '#64748b' }}>
                        {favorites?.has(item.id) ? <SavedFavoriteIcon fontSize="small" /> : <FavoriteIcon fontSize="small" />}
                      </IconButton>
                      <IconButton aria-label={'Eliminar ' + item.title} disabled={busy || loading || !!error} size="small" onClick={() => onRemoveItem(item.id)} sx={{ color: '#64748b' }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        aria-label={'Reducir cantidad de ' + item.title}
                        disabled={busy || loading || !!error || item.quantity <= 1 || !item.stock || item.disponibilidad === false}
                        size="small"
                        onClick={() => onUpdateQuantity(item.id, Math.min(item.quantity - 1, item.stock))}
                        sx={{ backgroundColor: '#064e3b', color: 'white', width: 24, height: 24, '&:hover': { backgroundColor: '#047857' } }}
                      >
                        <RemoveIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                      
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.quantity}
                      </Typography>

                      <IconButton
                        aria-label={'Aumentar cantidad de ' + item.title}
                        disabled={busy || loading || !!error || !item.available || item.quantity >= item.stock}
                        size="small"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        sx={{ backgroundColor: '#064e3b', color: 'white', width: 24, height: 24, '&:hover': { backgroundColor: '#047857' } }}
                      >
                        <AddIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Box>

        {/* Tarjeta inferior de Total */}
        <Box sx={{ p: 2 }}>
          <Paper elevation={0} sx={{ backgroundColor: '#8fa8bd', borderRadius: 4, p: 3, color: '#1e3a5f' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, color: '#1e3a5f' }}>
              Total
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ color: '#1e3a5f', fontWeight: 500 }}>
                {totalItems} {totalItems === 1 ? 'artículo' : 'artículos'}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e3a5f' }}>
                ${totalPrice.toFixed(2)}
              </Typography>
            </Box>

            <Divider sx={{ borderStyle: 'dotted', borderColor: '#1e3a5f', my: 2, borderWidth: 1 }} />

            <Button
              fullWidth
              variant="contained"
              size="large"
              disabled={!canBuy}
              onClick={() => setSummary(true)}
              sx={{
                backgroundColor: '#2b4c6f',
                color: 'white',
                borderRadius: 3,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '1rem',
                py: 1.2,
                '&:hover': { backgroundColor: '#1e3a5f' },
                '&.Mui-disabled': { backgroundColor: '#a0aec0', color: '#e2e8f0' }
              }}
            >
              Realizar Compra
            </Button>
          </Paper>
        </Box>

      </Box>
      {open && summary && <CheckoutDialog items={cartItems} total={totalPrice} canBuy={canBuy}
        onCheckout={onCheckout} onClose={() => setSummary(false)} onViewOrders={onViewOrders} onRetry={onRetry} />}
    </Drawer>
  );
}
