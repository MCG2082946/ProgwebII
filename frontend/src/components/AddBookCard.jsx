//Diseño de apartado para agregar un nuevo libro

import React from 'react';
import { Card, IconButton } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

export default function AddBookCard({ onAdd }) {
  return (
    <Card
      elevation={0}
      onClick={onAdd}
      sx={{
        borderRadius: 3,
        border: '2px dashed #b0bec5',
        backgroundColor: '#ffffff',
        height: '100%',
        minHeight: 330,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: '#f0f4f8',
          borderColor: '#3b6c93',
        },
      }}
    >
      <IconButton
        aria-label="Agregar libro"
        sx={{
          backgroundColor: '#3b6c93',
          color: 'white',
          width: 70,
          height: 70,
          '&:hover': { backgroundColor: '#1a365d' },
        }}
      >
        <AddIcon sx={{ fontSize: 48 }} />
      </IconButton>
    </Card>
  );
}