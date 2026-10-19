// Modal de Inicio de Sesion y Registro de Usuario

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Divider,
  Tab,
  Tabs,
  InputAdornment,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  Google as GoogleIcon,
  Facebook as FacebookIcon,
  Visibility,
  VisibilityOff,
  Key as KeyIcon
} from '@mui/icons-material';

export default function LoginModal({ open, onClose, onLoginSuccess, logoPath }) {
  const [tabIndex, setTabIndex] = useState(0); 
  const [showPassword, setShowPassword] = useState(false);

  // Estados del formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('client');
  const [sellerKey, setSellerKey] = useState(''); 
  const [errorMessage, setErrorMessage] = useState(''); 

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
    setErrorMessage('');
  };

  const handleRoleChange = (e) => {
    setRole(e.target.value);
    setErrorMessage('');
    setSellerKey('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email || !password) return;

    // Validación de la clave especial de vendedor
    if (role === 'seller' && sellerKey !== '1234') {
      setErrorMessage('La clave de vendedor es incorrecta.');
      return;
    }

    // Determinar endpoint según la pestaña (0: Login, 1: Registro)
    const isRegistering = tabIndex === 1;
    const endpoint = isRegistering 
      ? 'http://localhost:5000/api/auth/registro' 
      : 'http://localhost:5000/api/auth/login';

    const payload = isRegistering 
      ? { nombre: name, email, password, rol: role }
      : { email, password };

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
        onLoginSuccess(data.usuario || { email, name, role });
        onClose();
      } else {
        // Muestra el mensaje específico o el detalle del error devuelto por el backend
        const msgError = data.mensaje || data.error || 'Ocurrió un error al procesar la solicitud.';
        setErrorMessage(msgError);
      }
    } catch (error) {
      console.error('Error de conexión:', error);
      setErrorMessage('No se pudo conectar con el servidor Back-End (puerto 5000).');
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

      <DialogContent sx={{ pt: 0, px: 3, pb: 3 }}>
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
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tabIndex === 1 && (
            <TextField
              label="Nombre Completo"
              fullWidth
              size="small"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}

          <TextField
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

          {/* Selector de Tipo de Cuenta */}
          <FormControl component="fieldset" sx={{ mt: 0.5 }}>
            <FormLabel component="legend" sx={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
              Tipo de cuenta:
            </FormLabel>
            <RadioGroup
              row
              value={role}
              onChange={handleRoleChange}
            >
              <FormControlLabel 
                value="client" 
                control={<Radio size="small" sx={{ color: '#2b4c6f', '&.Mui-checked': { color: '#2b4c6f' } }} />} 
                label={<Typography variant="body2" sx={{ fontSize: '0.85rem' }}>Cliente</Typography>} 
              />
              <FormControlLabel 
                value="seller" 
                control={<Radio size="small" sx={{ color: '#2b4c6f', '&.Mui-checked': { color: '#2b4c6f' } }} />} 
                label={<Typography variant="body2" sx={{ fontSize: '0.85rem' }}>Vendedor</Typography>} 
              />
            </RadioGroup>
          </FormControl>

          {/* Campo condicional: Clave especial de vendedor */}
          {role === 'seller' && (
            <TextField
              label="Clave de Vendedor"
              type="password"
              fullWidth
              size="small"
              value={sellerKey}
              onChange={(e) => setSellerKey(e.target.value)}
              placeholder="Ingresa la clave (ej. 1234)"
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <KeyIcon fontSize="small" sx={{ color: '#64748b' }} />
                  </InputAdornment>
                )
              }}
              sx={{ backgroundColor: '#f8fafc', borderRadius: 1 }}
            />
          )}

          <Button
            type="submit"
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

        <Divider sx={{ my: 3 }}>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            O continúa con
          </Typography>
        </Divider>

        {/* Iniciar Sesión con Redes Sociales */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<GoogleIcon />}
            sx={{
              textTransform: 'none',
              borderColor: '#cbd5e1',
              color: '#334155',
              '&:hover': { borderColor: '#94a3b8', backgroundColor: '#f8fafc' }
            }}
          >
            Google
          </Button>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<FacebookIcon />}
            sx={{
              textTransform: 'none',
              borderColor: '#cbd5e1',
              color: '#334155',
              '&:hover': { borderColor: '#94a3b8', backgroundColor: '#f8fafc' }
            }}
          >
            Facebook
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}