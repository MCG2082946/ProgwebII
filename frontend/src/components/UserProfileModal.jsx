// Apartado de Info. Usuario

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Paper,
  Card,
  CardMedia,
  CardContent,
  Alert,
  Grid,
  Tabs,
  Tab,
  Button,
  Chip,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  Logout as LogoutIcon,
  Star as StarIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Person as PersonIcon,
  Bookmark as BookmarkIcon
} from '@mui/icons-material';

import ProfileNameFields from './ProfileNameFields';
import { nameFields, validateName } from '../profileName';
import { apiRequest } from '../api';

const profileDraft = (user) => ({
  ...Object.fromEntries(nameFields.map((key) => [key, user?.[key] ?? (key === 'sinSegundoApellido' ? false : '')])),
  email: user?.email || '',
});

export default function UserProfileModal({ open, onClose, user, onUpdateUser, onLogout, onGoToSellerPanel, wishlist = [] }) {
  const [tabIndex, setTabIndex] = useState(0);
  const [orders, setOrders] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setOrders([]); setHistoryError('');
    if (open && user && tabIndex === 1) {
      setHistoryLoading(true);
      apiRequest('/orders', { auth: true }).then((data) => {
        if (!Array.isArray(data)) throw new Error('Respuesta de historial invalida.');
        if (active) setOrders(data);
      }).catch((error) => { if (active) setHistoryError(error.message); })
        .finally(() => { if (active) setHistoryLoading(false); });
    }
    return () => { active = false; };
  }, [open, user, tabIndex]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const incompleteName = user?.nombreIncompleto === true || !validateName(user || {}).valid;
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({ nombres: '', primerApellido: '', segundoApellido: '', sinSegundoApellido: false, email: '' });
  useEffect(() => {
    if (open && user) {
      setFormData(profileDraft(user));
      setFieldErrors({});
      setIsEditing(false); setError(''); setTabIndex(0);
    }
  }, [user, open]);
  const handleChange = (field) => (e) => setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  const handleSave = async () => {
    if (pending.current) return;
    setError(''); setSuccess('');
    const result = validateName(formData);
    const errors = { ...result.errors };
    if (formData.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Indica un correo electrónico válido de hasta 254 caracteres.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    pending.current = true; setSaving(true);
    try {
      const { usuario } = await apiRequest('/auth/me', { method: 'PATCH', auth: true,
        body: { ...result.data, email: formData.email.trim() } });
      onUpdateUser(usuario);
      setIsEditing(false); setSuccess('Perfil guardado.');
    } catch (error) { setError(error.message); setFieldErrors(error.campos || (error.status === 409 ? { email: error.message } : {})); }
    finally { pending.current = false; setSaving(false); }
  };
  const close = () => { if (!pending.current) { setSuccess(''); onClose(); } };
  const cancelEdit = () => {
    if (pending.current) return;
    setFormData(profileDraft(user));
    setFieldErrors({}); setError(''); setSuccess(''); setIsEditing(false);
  };

  return (
    <Dialog
      aria-labelledby="profile-dialog-title"
      open={open}
      onClose={close}
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
        <Typography id="profile-dialog-title" variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
          Mi perfil
        </Typography>
        <IconButton onClick={close} disabled={saving} aria-label="Cerrar perfil" sx={{ color: '#ffffff', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* BARRA DE NAVEGACIÓN DE PESTAÑAS */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: '#ffffff', px: 2 }}>
        <Tabs
          variant="scrollable"
          scrollButtons="auto"
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
      <DialogContent sx={{ p: { xs: 2, sm: 3 }, minHeight: 420 }}>
        
        {/* PESTAÑA 1: DATOS PERSONALES */}
        {tabIndex === 0 && (
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: '1 1 220px' }}>
                <Avatar sx={{ width: 64, height: 64, flexShrink: 0, backgroundColor: '#1e3a5f', fontSize: '1.5rem', fontWeight: 700 }}>
                  {user?.nombre ? user?.nombre.charAt(0).toUpperCase() : 'U'}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                    {user?.nombre}
                  </Typography>
                  {user?.rol === 'vendedor' && <Chip label="Vendedor" size="small" sx={{ backgroundColor: '#e2e8f0', color: '#1e3a5f', fontWeight: 600 }} />}
                  </Box>
                  <Typography variant="body2" sx={{ color: '#64748b', overflowWrap: 'anywhere' }}>
                    {user?.email}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {isEditing && <Button disabled={saving} onClick={cancelEdit} color="inherit">Cancelar</Button>}
              {(isEditing || !incompleteName) && <Button
                disabled={saving}
                variant={isEditing ? 'contained' : 'outlined'}
                color={isEditing ? 'primary' : 'inherit'}
                startIcon={isEditing ? <SaveIcon /> : <EditIcon />}
                onClick={isEditing ? handleSave : () => setIsEditing(true)}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                {saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Editar Perfil'}
              </Button>}
              </Box>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}
            <Divider sx={{ my: 2 }} />

            {incompleteName &&
              <Alert severity="info" sx={{ mb: 2, flexWrap: 'wrap', gap: 1, '& .MuiAlert-action': { ml: 0, pl: 0, pt: 0 } }}
                action={!isEditing && <Button onClick={() => setIsEditing(true)} sx={{ textTransform: 'none', color: '#1e3a5f' }}>Completar perfil</Button>}>
                Falta completar tu nombre. Indica tus nombres y apellidos para guardar el perfil.
              </Alert>}
            {isEditing ? (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <ProfileNameFields value={formData} errors={fieldErrors} disabled={saving}
                  onChange={(field, value) => setFormData((prev) => ({ ...prev, [field]: value }))} />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  disabled={saving}
                  error={Boolean(fieldErrors.email)}
                  helperText={fieldErrors.email}
                  label="Correo electrónico"
                  type="email"
                  value={formData.email}
                  onChange={handleChange('email')}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
              </Grid>

            </Grid>
            ) : (
              <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                {Object.entries({ nombres: 'Nombre(s)', primerApellido: 'Primer apellido',
                  ...(!user?.sinSegundoApellido && user?.segundoApellido ? { segundoApellido: 'Segundo apellido' } : {}),
                  email: 'Correo electrónico' }).map(([field, label]) => (
                  <Box key={field}>
                    <Typography component="dt" variant="caption" sx={{ fontWeight: 600, color: '#475569' }}>{label}</Typography>
                    <Typography component="dd" variant="body2" sx={{ m: 0, color: '#0f172a', overflowWrap: 'anywhere' }}>{user?.[field] || 'Sin completar'}</Typography>
                  </Box>
                ))}
              </Box>
            )}
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

            <Typography variant="subtitle1">Historial de compras ({orders.length})</Typography>
            {historyLoading && <Typography role="status">Cargando pedidos...</Typography>}
            {historyError && <Alert severity="error">{historyError}</Alert>}
            {!historyLoading && !historyError && orders.length === 0 && <Typography>Aún no has realizado compras.</Typography>}
            {!historyLoading && !historyError && orders.map((order) => <Paper key={order._id} sx={{ p: 2, my: 1 }}>
              <Typography>Pedido: {order._id}</Typography>
              <Typography>{new Date(order.createdAt).toLocaleString()} - {order.metodo_pago} - {order.estado}</Typography>
              {order.detalles.map((item, index) => <Typography key={index}>{item.titulo} - {item.cantidad} x $ {item.precio_unitario.toFixed(2)}</Typography>)}
              <Typography>Total: $ {order.total.toFixed(2)}</Typography>
            </Paper>)}

          </Box>
        )}

      </DialogContent>
      {user && (
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap', gap: 1 }}>
          {user.rol === 'vendedor' && onGoToSellerPanel && (
            <Button disabled={saving} variant="outlined" onClick={() => {
              if (pending.current) return;
              close(); onGoToSellerPanel();
            }}>Ir al panel del vendedor</Button>
          )}
          <Button disabled={saving} onClick={onLogout} startIcon={<LogoutIcon />} color="error"
            variant="outlined" sx={{ textTransform: 'none', borderRadius: 2 }}>
            Cerrar sesión
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
