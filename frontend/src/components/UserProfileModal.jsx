// Apartado de Info. Usuario

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Paper,
  Card,
  CardMedia,
  CardContent,
  InputAdornment,
  Grid,
  Tabs,
  Tab,
  Button,
  Chip,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  Visibility,
  VisibilityOff,
  Star as StarIcon,
  AttachMoney as MoneyIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Person as PersonIcon,
  Bookmark as BookmarkIcon
} from '@mui/icons-material';

export default function UserProfileModal({ open, onClose, user, onUpdateUser, wishlist = [], purchasedBooks = [] }) {
  const [tabIndex, setTabIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || user.name || '',
        lastName: user.lastName || '',
        email: user.email || '',
        password: user.password || '••••••••'
      });
    }
  }, [user]);

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = () => {
    if (onUpdateUser) onUpdateUser(formData);
    setIsEditing(false);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          backgroundColor: '#f8fafc',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }
      }}
    >
      {/* CABECERA DEL MODAL */}
      <Box
        sx={{
          backgroundColor: '#1e3a5f',
          color: '#ffffff',
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
          Mi Cuenta
        </Typography>
        <IconButton onClick={onClose} sx={{ color: '#ffffff', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* BARRA DE NAVEGACIÓN DE PESTAÑAS */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: '#ffffff', px: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={(e, newIndex) => setTabIndex(newIndex)}
          textColor="primary"
          indicatorColor="primary"
          sx={{
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.95rem', minHeight: 48 }
          }}
        >
          <Tab icon={<PersonIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Datos Personales" />
          <Tab icon={<BookmarkIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Deseados y Comprados" />
        </Tabs>
      </Box>

      {/* CONTENIDO DEL MODAL */}
      <DialogContent sx={{ p: 3, minHeight: 420 }}>
        
        {/* PESTAÑA 1: DATOS PERSONALES */}
        {tabIndex === 0 && (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ width: 64, height: 64, backgroundColor: '#1e3a5f', fontSize: '1.5rem', fontWeight: 700 }}>
                  {formData.firstName ? formData.firstName.charAt(0).toUpperCase() : 'U'}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                    {formData.firstName} {formData.lastName}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    {formData.email}
                  </Typography>
                </Box>
              </Box>

              <Button
                variant={isEditing ? 'contained' : 'outlined'}
                color={isEditing ? 'primary' : 'inherit'}
                startIcon={isEditing ? <SaveIcon /> : <EditIcon />}
                onClick={isEditing ? handleSave : () => setIsEditing(true)}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                {isEditing ? 'Guardar Cambios' : 'Editar Perfil'}
              </Button>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569', mb: 0.5, display: 'block' }}>
                  Nombre(s)
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  disabled={!isEditing}
                  value={formData.firstName}
                  onChange={handleChange('firstName')}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569', mb: 0.5, display: 'block' }}>
                  Apellido(s)
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  disabled={!isEditing}
                  value={formData.lastName}
                  onChange={handleChange('lastName')}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569', mb: 0.5, display: 'block' }}>
                  Correo electrónico
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  disabled={!isEditing}
                  value={formData.email}
                  onChange={handleChange('email')}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569', mb: 0.5, display: 'block' }}>
                  Contraseña
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  disabled={!isEditing}
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange('password')}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* PESTAÑA 2: DESEADOS Y COMPRADOS */}
        {tabIndex === 1 && (
          <Box>
            {/* SECCIÓN DESEADOS */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e3a5f', mb: 1.5 }}>
              Lista de Deseos ({wishlist.length})
            </Typography>
            
            {wishlist.length === 0 ? (
              <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3 }}>No tienes productos en tu lista de deseos.</Typography>
            ) : (
              <Grid container spacing={2} sx={{ mb: 4 }}>
                {wishlist.map((book) => (
                  <Grid item xs={6} sm={4} md={3} key={book.id}>
                    <Card
                      elevation={0}
                      sx={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 2,
                        position: 'relative',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <Chip
                        icon={<StarIcon sx={{ fontSize: '14px !important', color: '#fff !important' }} />}
                        label="Deseado"
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          backgroundColor: '#1e3a5f',
                          color: '#ffffff',
                          fontWeight: 600,
                          fontSize: '0.65rem',
                          height: 22
                        }}
                      />
                      <CardMedia
                        component="img"
                        height="140"
                        image={book.cover}
                        alt={book.title}
                        sx={{ objectFit: 'cover' }}
                      />
                      <CardContent sx={{ p: 1.5, flexGrow: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2, color: '#0f172a', mb: 0.5 }}>
                          {book.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                          {book.author}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}

            <Divider sx={{ my: 3 }} />

            {/* SECCIÓN COMPRADOS */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e3a5f', mb: 1.5 }}>
              Historial de Compras ({purchasedBooks.length})
            </Typography>

            {purchasedBooks.length === 0 ? (
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>Aún no has realizado compras.</Typography>
            ) : (
              <Grid container spacing={2}>
                {purchasedBooks.map((book, idx) => (
                  <Grid item xs={6} sm={4} md={3} key={idx}>
                    <Card
                      elevation={0}
                      sx={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 2,
                        position: 'relative',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <Chip
                        icon={<MoneyIcon sx={{ fontSize: '14px !important', color: '#fff !important' }} />}
                        label="Comprado"
                        size="small"
                        color="success"
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          fontWeight: 600,
                          fontSize: '0.65rem',
                          height: 22
                        }}
                      />
                      <CardMedia
                        component="img"
                        height="140"
                        image={book.cover}
                        alt={book.title}
                        sx={{ objectFit: 'cover' }}
                      />
                      <CardContent sx={{ p: 1.5, flexGrow: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2, color: '#0f172a', mb: 0.5 }}>
                          {book.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                          {book.author}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        )}

      </DialogContent>
    </Dialog>
  );
}