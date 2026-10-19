//Carrusel de colecciones o categorias 

import React, { useRef } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import BookCard from './BookCard';
import AddBookCard from './AddBookCard';

export default function BookSlider({ title, books, isSeller, onSelect, onEdit, onAddToCart, onAdd }) {
  const sliderRef = useRef(null);

  const handleScroll = (direction) => {
    if (sliderRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      sliderRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <Box sx={{ mb: 6, position: 'relative' }}>
      <Typography variant="h5" sx={{ color: '#1e3a5f', fontWeight: 700, mb: 2, borderBottom: '2px solid #e0e0e0', pb: 1 }}>
        {title}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        <IconButton
          onClick={() => handleScroll('left')}
          sx={{
            position: 'absolute',
            left: -20,
            zIndex: 3,
            backgroundColor: '#1e3a5f',
            color: 'white',
            boxShadow: 3,
            '&:hover': { backgroundColor: '#2b5278' },
          }}
        >
          <ChevronLeft />
        </IconButton>

        {/* Contenedor desplazable de libros */}
        <Box
          ref={sliderRef}
          sx={{
            display: 'flex',
            gap: 2.5,
            overflowX: 'auto',
            scrollBehavior: 'smooth',
            py: 1,
            px: 1,
            width: '100%',
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          {isSeller && (
            <Box sx={{ minWidth: 200, flexShrink: 0 }}>
              <AddBookCard onAdd={onAdd} />
            </Box>
          )}

          {books.map((book) => (
            <Box key={book.id} sx={{ minWidth: 200, flexShrink: 0 }}>
              <BookCard
                book={book}
                isSeller={isSeller}
                onSelect={onSelect}
                onEdit={onEdit}
                onAddToCart={onAddToCart}
              />
            </Box>
          ))}
        </Box>

        <IconButton
          onClick={() => handleScroll('right')}
          sx={{
            position: 'absolute',
            right: -20,
            zIndex: 3,
            backgroundColor: '#1e3a5f',
            color: 'white',
            boxShadow: 3,
            '&:hover': { backgroundColor: '#2b5278' },
          }}
        >
          <ChevronRight />
        </IconButton>
      </Box>
    </Box>
  );
}