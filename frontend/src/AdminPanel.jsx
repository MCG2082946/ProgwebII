import { useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent,
  DialogTitle, Paper, Stack, TextField, Typography,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { apiRequest } from './api';

const roleLabels = { cliente: 'Cliente', vendedor: 'Vendedor', administrador: 'Administrador' };
const headingColor = '#1e3a5f';

export default function AdminPanel({ onLogout }) {
  const [email, setEmail] = useState('');
  const [account, setAccount] = useState(null);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [promotionError, setPromotionError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(null);
  const pending = useRef(false);
  const eligible = account?.rol === 'cliente' && !account.nombreIncompleto;

  async function search(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy('search');
    setAccount(null);
    setSearched(false);
    setSearchError(null);
    setSuccess(false);
    try {
      const { usuario } = await apiRequest('/auth/usuarios/buscar', {
        method: 'POST', auth: true, body: { email: email.trim() },
      });
      setAccount(usuario);
      setSearched(true);
    } catch (error) {
      setSearchError(error);
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  async function promote() {
    if (pending.current || !eligible || !confirming) return;
    pending.current = true;
    setBusy('save');
    setPromotionError('');
    try {
      const { usuario } = await apiRequest(`/auth/usuarios/${account.id}/vendedor`, { method: 'PATCH', auth: true, body: {} });
      setAccount(usuario);
      setConfirming(false);
      setSuccess(true);
    } catch (error) {
      setPromotionError(error.message);
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  function closeConfirmation() {
    if (!pending.current) setConfirming(false);
  }

  return <Box component="main" sx={{ minHeight: '100vh', bgcolor: '#f4f7f9', py: { xs: 2, sm: 5 } }}>
    <Container maxWidth="md">
      <Stack direction="row" useFlexGap sx={{ mb: 2, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Button component={Link} to="/" startIcon={<ArrowBack />} sx={{ color: headingColor, textTransform: 'none' }}>
          Volver a la tienda
        </Button>
        <Button variant="outlined" color="error" onClick={onLogout} disabled={Boolean(busy)} sx={{ textTransform: 'none' }}>
          Cerrar sesión
        </Button>
      </Stack>
      <Typography component="h1" variant="h4" sx={{ color: headingColor, fontWeight: 700, mb: 2 }}>Panel de administración</Typography>
      <Paper component="section" aria-labelledby="seller-enablement" variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
        <Typography id="seller-enablement" component="h2" variant="h6" sx={{ color: headingColor, mb: 2 }}>Habilitar vendedores</Typography>
        <Stack component="form" noValidate onSubmit={search} spacing={1.5} direction={{ xs: 'column', sm: 'row' }}>
          <TextField type="email" fullWidth required size="small" label="Correo electrónico"
            value={email} disabled={Boolean(busy)} error={searchError?.status === 400}
            helperText={searchError?.status === 400 ? searchError.message : undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              setAccount(null);
              setSearched(false);
              setSearchError(null);
              setSuccess(false);
            }} />
          <Button type="submit" variant="contained" disabled={Boolean(busy)}
            sx={{ bgcolor: headingColor, textTransform: 'none', whiteSpace: 'nowrap', alignSelf: { sm: 'flex-start' }, minHeight: 40 }}>
            Buscar cuenta
          </Button>
        </Stack>
        {busy === 'search' && <Typography role="status" sx={{ mt: 2 }}>Buscando cuenta…</Typography>}
        {searchError && searchError.status !== 400 && <Alert severity="error" sx={{ mt: 2 }}>{searchError.message}</Alert>}
        {searched && !account && <Typography role="status" sx={{ mt: 2 }}>No se encontró una cuenta con ese correo.</Typography>}
        {success && <Alert severity="success" sx={{ mt: 2 }}>Cuenta habilitada como vendedor</Alert>}
        {account && <Paper component="article" variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 2, overflowWrap: 'anywhere' }}>
          <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
            <Box>
              <Typography component="h3" variant="subtitle1" sx={{ color: headingColor, fontWeight: 700 }}>{account.nombre}</Typography>
              <Typography color="text.secondary">{account.email}</Typography>
            </Box>
            <Chip label={roleLabels[account.rol]} size="small" />
            {eligible ? <Button variant="contained" sx={{ bgcolor: headingColor, textTransform: 'none' }}
              onClick={() => { setPromotionError(''); setConfirming(true); }}>
              Habilitar como vendedor
            </Button> : <Typography variant="body2" color="text.secondary">
              {account.rol === 'vendedor' ? 'Esta cuenta ya tiene el rol de vendedor.' :
                account.rol === 'administrador' ? 'Esta cuenta tiene el rol de administrador.' :
                  'La cuenta debe completar su nombre y apellidos desde Mi perfil antes de habilitarse.'}
            </Typography>}
          </Stack>
        </Paper>}
      </Paper>
    </Container>
    <Dialog open={confirming} onClose={closeConfirmation} fullWidth maxWidth="xs" aria-labelledby="promotion-title">
      <DialogTitle id="promotion-title">Confirmar habilitación</DialogTitle>
      <DialogContent>
        <Typography sx={{ overflowWrap: 'anywhere' }}>
          ¿Quieres habilitar como vendedor a <strong>{account?.nombre}</strong> ({account?.email})?
        </Typography>
        {busy === 'save' && <Typography role="status" sx={{ mt: 1 }}>Guardando cambio…</Typography>}
        {promotionError && <Alert severity="error" sx={{ mt: 1 }}>{promotionError}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={closeConfirmation} disabled={Boolean(busy)}>Cancelar</Button>
        <Button variant="contained" onClick={promote} disabled={Boolean(busy)} sx={{ bgcolor: headingColor, textTransform: 'none' }}>
          Confirmar habilitación
        </Button>
      </DialogActions>
    </Dialog>
  </Box>;
}
