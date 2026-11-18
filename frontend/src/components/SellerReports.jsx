import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { apiRequest } from '../api';

const headingColor = '#1e3a5f';
const numberFormat = new Intl.NumberFormat('es-MX');

function initialRange() {
  const today = new Date();
  const first = new Date(today);
  first.setUTCDate(first.getUTCDate() - 29);
  return { desde: first.toISOString().slice(0, 10), hasta: today.toISOString().slice(0, 10) };
}

function ReportTable({ id, title, description, columns, rows, empty }) {
  return <Paper component="section" variant="outlined" aria-labelledby={id} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, minWidth: 0 }}>
    <Typography id={id} variant="h6" component="h3" sx={{ color: headingColor, fontWeight: 700 }}>{title}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>{description}</Typography>
    {rows.length ? <TableContainer>
      <Table size="small" aria-labelledby={id}>
        <TableHead sx={{ bgcolor: '#f0f5fa' }}>
          <TableRow>{columns.map(([field, label, numeric]) =>
            <TableCell key={field} scope="col" align={numeric ? 'right' : 'left'}>{label}</TableCell>)}</TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => <TableRow key={row.id ?? row.status}>
            {columns.map(([field, , numeric]) => <TableCell key={field} align={numeric ? 'right' : 'left'}
              sx={{ overflowWrap: 'anywhere' }}>{numeric ? numberFormat.format(row[field]) : row[field]}</TableCell>)}
          </TableRow>)}
        </TableBody>
      </Table>
    </TableContainer> : <Typography variant="body2">{empty}</Typography>}
  </Paper>;
}

export default function SellerReports() {
  const [range, setRange] = useState(initialRange);
  const [request, setRequest] = useState(() => ({ range }));
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/reports?' + new URLSearchParams(request.range), { auth: true, signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setResult(data); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request]);

  function load(nextRange) {
    setLoading(true);
    setError('');
    setResult(null);
    setRequest({ range: nextRange });
  }

  return <Box component="section" aria-labelledby="seller-reports-title">
    <Typography id="seller-reports-title" variant="h5" component="h2" sx={{ color: headingColor, fontWeight: 700, mb: 2 }}>Reportes</Typography>
    <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3 }}>
      <Box component="form" onSubmit={(event) => { event.preventDefault(); load(range); }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Periodo de pedidos y ranking</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Fechas en UTC. Se incluyen los dos días seleccionados.</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          {Object.entries({ desde: 'Desde', hasta: 'Hasta' }).map(([field, label]) =>
            <TextField key={field} id={`reports-${field}`} required size="small" type="date" label={label} value={range[field]}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: field === 'desde' ? { max: range.hasta } : { min: range.desde } }}
              onChange={(event) => setRange((previous) => ({ ...previous, [field]: event.target.value }))} />)}
          <Button variant="contained" type="submit" disabled={loading} sx={{ bgcolor: headingColor, textTransform: 'none' }}>Aplicar periodo</Button>
        </Stack>
      </Box>
    </Paper>
    {loading && <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }} role="status">
      <CircularProgress size={20} aria-hidden="true" /><Typography>Cargando reportes...</Typography>
    </Stack>}
    {error && <Alert severity="error" action={<Button onClick={() => load(request.range)}>Reintentar</Button>}>{error}</Alert>}
    {result && <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
      <ReportTable id="report-low-stock" title="Libros con bajo stock"
        description={`Umbral aplicado: ${result.lowStockThreshold} unidades o menos por título.`}
        columns={[[ 'title', 'Título' ], [ 'category', 'Categoría' ], [ 'units', 'Unidades', true ]]}
        rows={result.lowStock} empty="No hay libros con bajo stock." />
      <ReportTable id="report-inventory" title="Inventario por categoría"
        description="Títulos cuenta los libros distintos. Ejemplares suma sus unidades en stock."
        columns={[[ 'category', 'Categoría' ], [ 'titles', 'Títulos', true ], [ 'units', 'Ejemplares', true ]]}
        rows={result.inventory} empty="No hay libros en tu inventario." />
      <ReportTable id="report-period" title="Pedidos por periodo"
        description={`Del ${request.range.desde} al ${request.range.hasta}. Las unidades corresponden a tus libros en cada pedido.`}
        columns={[[ 'status', 'Estado' ], [ 'orders', 'Pedidos', true ], [ 'units', 'Unidades', true ]]}
        rows={result.orders} empty="No hay pedidos de tus libros en este periodo." />
      <ReportTable id="report-ranking" title="Libros más comprados"
        description="Unidades de tus libros en pedidos confirmados del periodo. Excluye los pedidos pendientes."
        columns={[[ 'title', 'Título' ], [ 'units', 'Unidades', true ]]}
        rows={result.ranking} empty="No hay compras confirmadas de tus libros en este periodo." />
    </Box>}
  </Box>;
}
