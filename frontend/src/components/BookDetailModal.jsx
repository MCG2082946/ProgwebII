import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import { Close, Favorite, FavoriteBorder, ShoppingCart } from '@mui/icons-material';
import { mxn } from '../paymentDemo';
import BookCover from './BookCover';

export default function BookDetailModal({ open, book, onClose, onAddToCart, favorite = false, favoritesDisabled = false, ownPublication = false,
  onFavorite, favoritesError = '', onRetryFavorites }) {
  if (!book) return null;
  const details = [
    ['Categorías', book.categories?.join(', ')],
    ['Encuadernación', book.binding],
    ['ISBN', book.isbn],
    ['Disponibilidad', book.availabilityLabel],
  ].filter(([, value]) => value);
  return <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="book-detail-title">
    <DialogTitle id="book-detail-title" sx={{ bgcolor: '#1e3a5f', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      Ficha del libro
      <IconButton aria-label="Cerrar detalle" onClick={onClose} sx={{ color: 'white' }}><Close /></IconButton>
    </DialogTitle>
    <DialogContent sx={{ py: 3 }}>
      {favoritesError && <Alert severity="error" action={<Button onClick={onRetryFavorites}>Reintentar favoritos</Button>}>{favoritesError}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 2fr) minmax(0, 3fr)' }, gap: 3, pt: 2 }}>
        <BookCover src={book.cover} title={book.title} height={280} />
        <Stack spacing={1.5} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          <Box>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, color: '#1e3a5f' }}>{book.title}</Typography>
            <Typography color="text.secondary">{book.author}</Typography>
          </Box>
          <Typography variant="h6">{mxn.format(book.price)}</Typography>
          {details.length > 0 && <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 1 }}>
            {details.map(([label, value]) => <Box key={label} sx={{ display: 'contents' }}>
              <Typography component="dt" variant="body2" sx={{ fontWeight: 700 }}>{label}</Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0 }}>{value}</Typography>
            </Box>)}
          </Box>}
          {book.description && <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{book.description}</Typography>}
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Button variant="contained" startIcon={<ShoppingCart />} disabled={ownPublication || !book.available}
              onClick={() => onAddToCart(book)} sx={{ bgcolor: '#1e3a5f', textTransform: 'none' }}>
              {ownPublication ? 'Es tu publicación' : 'Añadir al carrito'}
            </Button>
            <IconButton aria-label={(favorite ? 'Quitar de favoritos ' : 'Guardar en favoritos ') + book.title}
              aria-pressed={favorite} disabled={favoritesDisabled || !onFavorite} onClick={() => onFavorite(book)}>
              {favorite ? <Favorite /> : <FavoriteBorder />}
            </IconButton>
          </Stack>
        </Stack>
      </Box>
    </DialogContent>
  </Dialog>;
}
