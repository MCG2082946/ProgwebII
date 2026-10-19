//Ventana emergente que muestra la informacion completa del libro

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  IconButton,
  Grid,
  Paper,
  Button
} from '@mui/material';
import {
  Info as InfoIcon,
  Close as CloseIcon,
  Star as StarIcon,
  ShoppingCart as ShoppingCartIcon
} from '@mui/icons-material';

export default function BookDetailModal({ open, book, onClose, onAddToCart }) {
  if (!book) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
    >
      {/* Encabezado */}
      <DialogTitle
        sx={{
          backgroundColor: '#4a79a0',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 1.5,
          px: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoIcon />
          <Typography variant="h6" sx={{ fontStyle: 'italic', fontWeight: 'bold' }}>
            Informacion Libro
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Cuerpo */}
      <DialogContent sx={{ p: 4, backgroundColor: '#fcfdfd' }}>
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={5}>
            <Paper
              elevation={1}
              sx={{
                p: 2,
                borderRadius: 3,
                border: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Box
                component="img"
                src={book.cover}
                alt={book.title}
                sx={{
                  width: '100%',
                  maxHeight: 320,
                  objectFit: 'contain',
                  borderRadius: 1,
                }}
              />
            </Paper>
          </Grid>

          <Grid item xs={12} md={7}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1a365d', mb: 1 }}>
              {book.title}
            </Typography>

            <Typography variant="subtitle1" sx={{ fontStyle: 'italic', color: '#4a79a0', mb: 2 }}>
              {book.author}
            </Typography>

            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 3,
                borderColor: '#d0d7de',
                backgroundColor: '#ffffff',
                mb: 3,
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {book.synopsis}
              </Typography>
            </Paper>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                variant="contained"
                sx={{
                  backgroundColor: '#4a79a0',
                  borderRadius: '20px',
                  px: 3,
                  py: 1,
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  textTransform: 'none',
                  '&:hover': { backgroundColor: '#2b5278' },
                }}
              >
                $ {book.price ? book.price.toFixed(2) : '0.00'}
              </Button>

              <IconButton
                sx={{
                  backgroundColor: '#3b6c93',
                  color: 'white',
                  '&:hover': { backgroundColor: '#2b5278' },
                  p: 1.2,
                }}
              >
                <StarIcon />
              </IconButton>

              <IconButton
                onClick={() => onAddToCart(book)}
                sx={{
                  backgroundColor: '#ffffff',
                  color: '#1a365d',
                  border: '1px solid #d0d7de',
                  '&:hover': { backgroundColor: '#f0f0f0' },
                  p: 1.2,
                }}
              >
                <ShoppingCartIcon />
              </IconButton>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
}