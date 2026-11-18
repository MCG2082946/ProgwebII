import { useRef, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle,
  Divider, FormControlLabel, Paper, Radio, RadioGroup, Stack, TextField, Typography,
} from '@mui/material';
import {
  ArrowBack, CreditCard, AccountBalance, Payments, MenuBook, CheckCircle, Schedule,
} from '@mui/icons-material';
import { emptyCard, formatExpiry, mxn, orderStatus, paymentMethods, validateCard } from '../paymentDemo';

const ink = '#1e3a5f';
const methodIcons = { tarjeta: CreditCard, spei: AccountBalance, efectivo: Payments };
const cardFields = {
  holder: 'Nombre del titular',
  number: 'Número de tarjeta',
  expiry: 'Vencimiento MM/AA',
  code: 'Código de seguridad',
};

export default function CheckoutDialog({ items, total, canBuy, onCheckout, onClose, onViewOrders, onRetry }) {
  const [method, setMethod] = useState('tarjeta');
  const [card, setCard] = useState(emptyCard);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);
  const edited = useRef(new Set());
  const pending = useRef(false);
  const key = useRef(null);
  const submitted = useRef(false);

  function clearCard() {
    setCard(emptyCard());
    setErrors({});
    edited.current.clear();
  }

  async function confirm(event) {
    event.preventDefault();
    if (pending.current || !canBuy) return;
    if (method === 'tarjeta') {
      const invalid = validateCard(card);
      setErrors(invalid);
      if (Object.keys(invalid).length) return;
    }
    pending.current = true;
    submitted.current = true;
    setSending(true);
    setError('');
    clearCard();
    try {
      key.current ||= crypto.randomUUID();
      const result = await onCheckout(key.current, method);
      if (result) {
        setOrder(result);
        key.current = null;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      pending.current = false;
      setSending(false);
    }
  }

  function close() {
    if (pending.current) return;
    clearCard();
    onClose();
  }

  const isPending = order?.estado === 'pendiente_pago';
  const confirmation = isPending ? 'Pedido registrado' : 'Pedido confirmado';
  const panel = { p: { xs: 2, sm: 3 }, borderRadius: 3, minWidth: 0 };

  return <Dialog open fullScreen onClose={close} aria-labelledby="checkout-title">
    <DialogTitle id="checkout-title" sx={{ bgcolor: ink, color: 'white', px: { xs: 2, sm: 4 } }}>
      {order ? confirmation : 'Finalizar compra'}
    </DialogTitle>
    <DialogContent sx={{ bgcolor: '#f4f7f9', px: { xs: 2, sm: 3 }, py: { xs: 2, md: 4 } }}>
      <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
        {order ? <Paper variant="outlined" sx={{ ...panel, maxWidth: 620, mx: 'auto', mt: { xs: 1, md: 3 } }}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: isPending ? 'warning.light' : 'success.light', color: isPending ? 'warning.contrastText' : 'success.contrastText' }}>
                {isPending ? <Schedule /> : <CheckCircle />}
              </Avatar>
              <Chip label={orderStatus(order.estado)} color={isPending ? 'warning' : 'success'} variant="outlined" />
            </Stack>
            <Box>
              <Typography variant="overline" color="text.secondary">Folio del pedido</Typography>
              <Typography variant="h4" component="h2" sx={{ color: ink, fontWeight: 700, overflowWrap: 'anywhere' }}>
                {order.folio || order._id}
              </Typography>
            </Box>
            <Divider />
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
              <Box>
                <Typography variant="body2" color="text.secondary">Método de pago</Typography>
                <Typography>{order.metodo_pago}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Total</Typography>
                <Typography sx={{ fontWeight: 700 }}>{mxn.format(order.total)}</Typography>
              </Box>
            </Stack>
            <Button variant="contained" sx={{ bgcolor: ink, textTransform: 'none', alignSelf: { sm: 'flex-start' } }}
              onClick={() => { close(); onViewOrders?.(); }}>Ver mis pedidos</Button>
          </Stack>
        </Paper> : <>
          <Button startIcon={<ArrowBack />} disabled={sending} onClick={close} sx={{ mb: 2, color: ink, textTransform: 'none' }}>
            Volver al carrito
          </Button>
          {error && <Alert severity="error" sx={{ mb: 2 }} action={onRetry && <Button disabled={sending} onClick={onRetry}>Actualizar carrito</Button>}>{error}</Alert>}
          <Box component="form" autoComplete="off" onSubmit={confirm}
            sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.2fr) minmax(0, 1fr)' }, gap: { xs: 2, md: 3 }, alignItems: 'start' }}>
            <Paper component="section" variant="outlined" aria-labelledby="payment-label" sx={panel}>
              <Typography id="payment-label" component="h2" variant="h6" sx={{ color: ink, mb: 2 }}>Método de pago</Typography>
              <RadioGroup aria-labelledby="payment-label" value={method} onChange={(event) => {
                setMethod(event.target.value);
                clearCard();
              }}>
                <Stack spacing={1.25}>
                  {Object.entries(paymentMethods).map(([value, label]) => {
                    const Icon = methodIcons[value];
                    const selected = method === value;
                    return <Box key={value} sx={{
                      border: 1, borderColor: selected ? ink : 'divider', borderRadius: 2,
                      bgcolor: selected ? '#f0f5fa' : 'background.paper',
                    }}>
                      <FormControlLabel value={value} disabled={sending || submitted.current} control={<Radio />}
                        label={<Stack direction="row" alignItems="center" spacing={1}><Icon fontSize="small" /><span>{label}</span></Stack>}
                        sx={{ m: 0, px: 1, py: 0.5, width: '100%', color: ink }} />
                      {selected && (value === 'tarjeta' ? (
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, px: 2, pb: 1 }}>
                          {Object.entries(cardFields).map(([field, fieldLabel]) => <TextField key={field} label={fieldLabel} value={card[field]}
                            size="small" fullWidth disabled={sending} type={field === 'code' ? 'password' : 'text'} autoComplete="off"
                            error={!!errors[field]} helperText={errors[field] || ' '}
                            sx={{ gridColumn: field === 'holder' || field === 'number' ? '1 / -1' : undefined }}
                            slotProps={{ htmlInput: { inputMode: field === 'holder' ? 'text' : 'numeric' } }}
                            onChange={(event) => {
                              const value = event.target.value;
                              edited.current.add(field);
                              setCard((prev) => ({ ...prev, [field]: field === 'expiry' ? formatExpiry(value) : value }));
                              setErrors((prev) => ({ ...prev, [field]: undefined }));
                            }}
                            onBlur={() => {
                              if (edited.current.has(field)) setErrors((prev) => ({ ...prev, [field]: validateCard(card)[field] }));
                            }} />)}
                        </Box>
                      ) : <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 1.5 }}>
                        El pedido quedará pendiente de pago.
                      </Typography>)}
                    </Box>;
                  })}
                </Stack>
              </RadioGroup>
            </Paper>
            <Paper component="section" variant="outlined" aria-labelledby="summary-title" sx={panel}>
              <Typography id="summary-title" component="h2" variant="h6" sx={{ color: ink, mb: 2 }}>Resumen del pedido</Typography>
              <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
                {items.map((item) => <Box component="li" key={item.id} sx={{
                  display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: 1.25, alignItems: 'center',
                }}>
                  <Avatar variant="rounded" src={item.cover} alt="" sx={{ width: 36, height: 52, bgcolor: '#e2e8f0', color: ink }}>
                    <MenuBook fontSize="small" />
                  </Avatar>
                  <Box sx={{ overflowWrap: 'anywhere' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.title}</Typography>
                    <Typography variant="caption" color="text.secondary">Cantidad: {item.quantity}</Typography>
                  </Box>
                  <Typography variant="body2" align="right">{mxn.format(item.subtotal ?? item.quantity * item.price)}</Typography>
                </Box>)}
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Stack direction="row" justifyContent="space-between" gap={1} sx={{ mb: 1.5, color: ink }}>
                <Typography sx={{ fontWeight: 700 }}>Total</Typography>
                <Typography align="right" sx={{ fontWeight: 700 }}>{mxn.format(total)}</Typography>
              </Stack>
              <Button type="submit" fullWidth variant="contained" disabled={sending || !canBuy}
                sx={{ bgcolor: ink, textTransform: 'none' }}
                startIcon={sending ? <CircularProgress size={16} color="inherit" /> : undefined}>
                {method === 'tarjeta' ? 'Confirmar pedido' : 'Registrar pedido'}
              </Button>
              {sending && <Typography role="status" variant="body2" sx={{ mt: 1 }}>Guardando pedido...</Typography>}
            </Paper>
          </Box>
        </>}
      </Box>
    </DialogContent>
  </Dialog>;
}
