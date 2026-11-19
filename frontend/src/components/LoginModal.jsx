// Modal de Inicio de Sesion y Registro de Usuario

import React, { useRef, useState } from 'react';
import ProfileNameFields from './ProfileNameFields';
import { validateName } from '../profileName';
import { API_URL } from '../api';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Tab,
  Tabs,
  InputAdornment,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';

export default function LoginModal({ open, onClose, onLoginSuccess, logoPath }) {
  const [tabIndex, setTabIndex] = useState(0); 
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);

  // Estados del formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState({ nombres: '', primerApellido: '', segundoApellido: '', sinSegundoApellido: false });
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState(''); 

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
    setErrorMessage('');
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pending.current) return;
    setErrorMessage('');

    // Determinar endpoint según la pestaña (0: Login, 1: Registro)
    const isRegistering = tabIndex === 1;
    const endpoint = isRegistering 
      ? API_URL + '/auth/registro'
      : API_URL + '/auth/login';

    const result = validateName(name);
    const errors = isRegistering ? { ...result.errors } : {};
    if (!password) errors.password = 'Indica tu contraseña.';
    else if (new TextEncoder().encode(password).length > 72) errors.password = 'La contraseña admite hasta 72 bytes.';
    else if (isRegistering && password.length < 8) errors.password = 'Usa al menos 8 caracteres.';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Indica un correo válido de hasta 254 caracteres.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const payload = isRegistering 
      ? { ...result.data, email: email.trim(), password }
      : { email, password };

    pending.current = true;
    setSubmitting(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        // Guarda el token en el almacenamiento local si existe
        if (data.token) {
          localStorage.setItem('token', data.token);
        }
        
        // Pasa los datos del usuario retornado al componente padre
        onLoginSuccess(data.usuario);
        onClose();
      } else {
        // Muestra el mensaje específico o el detalle del error devuelto por el backend
        const msgError = data.mensaje || 'Ocurrió un error al procesar la solicitud.';
        setErrorMessage(msgError);
        setFieldErrors(data.campos || (response.status === 409 ? { email: msgError } : {}));
      }
    } catch {
      setErrorMessage('No se pudo conectar con el servidor. Intenta nuevamente.');
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          p: 1,
          backgroundColor: '#ffffff'
        }
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <IconButton onClick={onClose} size="small" sx={{ color: '#64748b' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: 0, px: 3, pb: 2.5 }}>
        {/* LOGO DE LA TIENDA */}
        {logoPath && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Box
              component="img"
              src={logoPath}
              alt="Logo"
              sx={{
                height: 60,
                objectFit: 'contain'
              }}
            />
          </Box>
        )}

        <Typography
          variant="h5"
          align="center"
          sx={{ fontWeight: 700, color: '#1e3a5f', mb: 2 }}
        >
          {tabIndex === 0 ? 'Bienvenido de nuevo' : 'Crear una cuenta'}
        </Typography>

        {/* Pestañas Iniciar Sesión / Registro */}
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          centered
          sx={{
            mb: 3,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 },
            '& .Mui-selected': { color: '#2b4c6f' },
            '& .MuiTabs-indicator': { backgroundColor: '#2b4c6f' }
          }}
        >
          <Tab label="Iniciar Sesión" />
          <Tab label="Registrarse" />
        </Tabs>

        {/* Mensaje de error devuelto por la API o validación local */}
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {errorMessage}
          </Alert>
        )}

        {/* Formulario */}
        <Box component="form" noValidate onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tabIndex === 1 && (
            <ProfileNameFields value={name} errors={fieldErrors}
              onChange={(field, value) => setName((prev) => ({ ...prev, [field]: value }))} />
          )}

          <TextField
            error={Boolean(fieldErrors.email)}
            helperText={fieldErrors.email}
            label="Correo Electrónico"
            type="email"
            fullWidth
            size="small"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <TextField
            label="Contraseña"
            error={Boolean(fieldErrors.password)}
            helperText={fieldErrors.password}
            type={showPassword ? 'text' : 'password'}
            fullWidth
            size="small"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          {tabIndex === 1 && (
            <Typography variant="caption" color="text.secondary">
              La cuenta se crea como cliente. Un administrador debe habilitar el acceso de vendedor.
            </Typography>
          )}

          <Button
            type="submit"
            disabled={submitting}
            fullWidth
            variant="contained"
            size="large"
            sx={{
              mt: 1,
              backgroundColor: '#2b4c6f',
              textTransform: 'none',
              fontWeight: 700,
              py: 1.2,
              '&:hover': { backgroundColor: '#1e3a5f' }
            }}
          >
            {tabIndex === 0 ? 'Iniciar Sesión' : 'Registrarme'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
