// Ventana emergente para agregar un nuevo libro

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  IconButton,
  Grid,
  Paper,
  TextField,
  InputAdornment,
  Button
} from '@mui/material';
import { Close as CloseIcon, CloudUpload as UploadIcon } from '@mui/icons-material';

export default function AddBookModal({ open, bookToEdit, onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    synopsis: '',
    price: '',
    cover: ''
  });

  useEffect(() => {
    if (bookToEdit) {
      setFormData({
        title: bookToEdit.title || '',
        author: bookToEdit.author || '',
        synopsis: bookToEdit.synopsis || '',
        price: bookToEdit.price || '',
        cover: bookToEdit.cover || ''
      });
    } else {
      setFormData({ title: '', author: '', synopsis: '', price: '', cover: '' });
    }
  }, [bookToEdit, open]);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setFormData({ ...formData, cover: imageUrl });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      price: parseFloat(formData.price) || 0,
      cover: formData.cover || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'
    });
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth 
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
    >
      {/* Encabezado del Modal */}
      <DialogTitle sx={{ backgroundColor: '#1e3a5f', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {bookToEdit ? 'Editar Libro' : 'Agregar Nuevo Libro'}
        </Typography>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Contenido con Formulario */}
      <DialogContent sx={{ p: { xs: 2, sm: 4 }, backgroundColor: '#ffffff' }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
          <Grid container spacing={3} alignItems="stretch">
            
            {/* Columna Izquierda: Carga de Imagen */}
            <Grid item xs={12} sm={4}>
              <Paper
                variant="outlined"
                sx={{
                  height: '100%',
                  minHeight: 260,
                  borderRadius: 2,
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  borderColor: '#1e3a5f',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f8fafc',
                  p: 2,
                  textAlign: 'center'
                }}
              >
                {formData.cover ? (
                  <Box 
                    component="img" 
                    src={formData.cover} 
                    alt="Portada" 
                    sx={{ maxHeight: 180, maxWidth: '100%', objectFit: 'contain', mb: 2, borderRadius: 1 }} 
                  />
                ) : (
                  <UploadIcon sx={{ fontSize: 52, color: '#1e3a5f', mb: 1 }} />
                )}
                
                <Button 
                  variant="outlined" 
                  component="label" 
                  size="small" 
                  sx={{ 
                    textTransform: 'none', 
                    borderColor: '#1e3a5f', 
                    color: '#1e3a5f',
                    fontWeight: 600,
                    '&:hover': { backgroundColor: 'rgba(30, 58, 95, 0.04)' } 
                  }}
                >
                  {formData.cover ? 'Cambiar Portada' : 'Subir Portada'}
                  <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
                </Button>
              </Paper>
            </Grid>

            {/* Columna Derecha: Campos del Libro */}
            <Grid item xs={12} sm={8}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField
                  fullWidth
                  label="Título del libro"
                  variant="outlined"
                  size="small"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />

                <TextField
                  fullWidth
                  label="Autor(a)"
                  variant="outlined"
                  size="small"
                  required
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                />

                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Sinopsis / Reseña"
                  variant="outlined"
                  value={formData.synopsis}
                  onChange={(e) => setFormData({ ...formData, synopsis: e.target.value })}
                />

                {/* Fila de Precio y Botón Guardar */}
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={5}>
                    <TextField
                      fullWidth
                      label="Precio"
                      type="number"
                      size="small"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={7}>
                    <Button 
                      type="submit"
                      fullWidth 
                      variant="contained" 
                      size="large"
                      sx={{ 
                        backgroundColor: '#1e3a5f', 
                        fontWeight: 'bold',
                        textTransform: 'none',
                        '&:hover': { backgroundColor: '#2b5278' } 
                      }}
                    >
                      Guardar Libro
                    </Button>
                  </Grid>
                </Grid>

              </Box>
            </Grid>

          </Grid>
        </Box>
      </DialogContent>
    </Dialog>
  );
}