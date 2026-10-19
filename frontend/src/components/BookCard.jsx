//Tarjeta individual con vista previa de libro registrado

import React from 'react';
import { Card, CardMedia, CardContent, Typography, Button, IconButton } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';

export default function BookCard({ book, isSeller, onSelect, onEdit, onAddToCart }) {
  return (
    <Card
      elevation={1}
      onClick={() => onSelect(book)}
      sx={{
        borderRadius: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        p: 2,
        height: '100%',
        justify: 'space-between',
        position: 'relative',
        cursor: 'pointer',
        transition: 'transform 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 3,
        },
      }}
    >
      {/* Icono flotante de edición */}
      {isSeller && (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(book);
          }}
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            backgroundColor: '#3b6c93',
            color: 'white',
            '&:hover': { backgroundColor: '#1a365d' },
            zIndex: 2,
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      )}

      <CardMedia
        component="img"
        image={book.cover}
        alt={book.title}
        sx={{
          height: 190,
          width: 'auto',
          objectFit: 'contain',
          borderRadius: 1,
          mb: 1.5,
        }}
      />

      <CardContent sx={{ p: 0, width: '100%', textAlign: 'left', flexGrow: 1 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {book.type || 'Tapa blanda'}
        </Typography>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 'bold',
            color: '#1a365d',
            lineHeight: 1.2,
            my: 0.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {book.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {book.author}
        </Typography>
      </CardContent>

      <Button
        variant="contained"
        fullWidth
        startIcon={<AddIcon />}
        onClick={(e) => {
          e.stopPropagation();
          onAddToCart(book);
        }}
        sx={{
          mt: 2,
          borderRadius: '20px',
          backgroundColor: '#4a79a0',
          textTransform: 'none',
          fontWeight: 'bold',
          '&:hover': { backgroundColor: '#2b5278' },
        }}
      >
        Añadir a compra
      </Button>
    </Card>
  );
}