//Apartado unicamente para vendedores

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  MenuItem,
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ArrowBack as ArrowBackIcon,
  Storefront as StorefrontIcon,
  Close as CloseIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiRequest, loadCatalog } from './api';

export default function SellerPanel({ user, onLogout }) {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const categoryPending = useRef(false);
  const handleSaveCategory = async (event) => {
    event.preventDefault();
    if (categoryPending.current) return;
    if (!categoryName.trim() || categoryName.length > 200) {
      setCategoryError('El nombre es obligatorio y debe tener como máximo 200 caracteres.');
      return;
    }
    categoryPending.current = true;
    setSavingCategory(true); setCategoryError('');
    try {
      const { categoria } = await apiRequest('/categories', {
        method: 'POST', auth: true, body: { nombre: categoryName.trim() },
      });
      setCategories((current) => [...current, categoria]);
      setCategoryModal(false);
    } catch (error) { setCategoryError(error.message); }
    finally { categoryPending.current = false; setSavingCategory(false); }
  };
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    loadCatalog({ mine: true, signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) { setBooks(data.books.map((b) => ({ ...b, seller: user.nombre }))); setCategories(data.categories); }
    }).catch((error) => {
      if (!controller.signal.aborted) { setBooks([]); setError(error.message); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user.nombre, reload]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para modal de formulario
  const [openModal, setOpenModal] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    seller: user?.nombre || 'Mi Tienda',
    price: '',
    cover: '', categoryId: '', stock: 0, tipoTapa: 'blanda', disponibilidad: true
  });

  const handleOpenAdd = () => {
    setEditingBook(null); setFormError('');
    setFormData({
      title: '',
      author: '',
      seller: user?.nombre || 'Mi Tienda',
      price: '',
      cover: '', categoryId: '', stock: 0, tipoTapa: 'blanda', disponibilidad: true
    });
    setOpenModal(true);
  };

  const handleOpenEdit = (book) => {
    setEditingBook(book); setFormError('');
    setFormData(book);
    setOpenModal(true);
  };

  const handleDelete = async (id) => {
    setBusy(true); setError('');
    try {
      await apiRequest('/books/' + id, { method: 'DELETE', auth: true });
      setBooks((current) => current.filter((b) => b.id !== id));
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  };
  const handleSave = async (e) => {
    e.preventDefault(); setBusy(true); setFormError('');
    try {
      await apiRequest('/books' + (editingBook ? '/' + editingBook.id : ''), {
        method: editingBook ? 'PATCH' : 'POST', auth: true,
        body: { titulo: formData.title, autor: formData.author, precio: Number(formData.price),
          portada_url: formData.cover || '', categoria: formData.categoryId,
          stock: Number(formData.stock), tipoTapa: formData.tipoTapa, disponibilidad: formData.disponibilidad },
      });
      setOpenModal(false); setReload((n) => n + 1);
    } catch (error) { setFormError(error.message); }
    finally { setBusy(false); }
  };

  const filteredBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.seller || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ backgroundColor: '#f4f7f9', minHeight: '100vh', py: 5 }}>
      <Container maxWidth="lg">
        {user && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="body2" color="text.secondary">{user.nombre || user.email}</Typography>
            <Button onClick={onLogout} startIcon={<LogoutIcon />} color="error"
              variant="outlined" sx={{ textTransform: 'none', borderRadius: 2 }}>
              Cerrar sesión
            </Button>
          </Box>
        )}
        
        {/* ENCABEZADO Y CONTROLES */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/')}
              sx={{ textTransform: 'none', borderRadius: 2, borderColor: '#cbd5e1', color: '#334155' }}
            >
              Volver a la Tienda
            </Button>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e3a5f' }}>
              Panel de Vendedor
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={loading || !!error || busy || !categories.length}
            onClick={handleOpenAdd}
            sx={{
              backgroundColor: '#1e3a5f',
              borderRadius: 3,
              px: 3,
              py: 1,
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { backgroundColor: '#2b5278' }
            }}
          >
            Agregar Libro
          </Button>
        </Box>

        {error && <Alert severity="error" action={<Button onClick={() => setReload((n) => n + 1)}>Reintentar</Button>}>{error}</Alert>}
        {!loading && !error && !categories.length && <Alert severity="info" action={
          <Button onClick={() => { setCategoryName(''); setCategoryError(''); setCategoryModal(true); }}>Crear categoría</Button>
        }>No hay categorías. Crea una categoría para agregar libros.</Alert>}
        {/* TABLA DE PRODUCTOS */}
        <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          
          {/* Barra de Filtro Interna */}
          <Box sx={{ p: 2, backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
            <TextField
              size="small"
              placeholder="Buscar por título, autor o vendedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#94a3b8' }} />
                  </InputAdornment>
                )
              }}
              sx={{ maxWidth: 400, width: '100%' }}
            />
          </Box>

          <TableContainer>
            <Table>
              <TableHead sx={{ backgroundColor: '#4a79a0' }}>
                <TableRow>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Imagen</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Título</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Autor</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Vendedor</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Precio</TableCell>
                  <TableCell align="center" sx={{ color: 'white', fontWeight: 700 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>

              <TableBody sx={{ backgroundColor: '#ffffff' }}>
                {filteredBooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#64748b' }}>
                      {loading ? 'Cargando inventario...' : error ? 'Inventario no disponible.' : 'No se encontraron libros en el inventario.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBooks.map((book) => (
                    <TableRow key={book.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      
                      {/* 1. Imagen */}
                      <TableCell>
                        <Avatar
                          variant="rounded"
                          src={book.cover}
                          alt={book.title}
                          sx={{ width: 48, height: 64, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}
                        />
                      </TableCell>

                      {/* 2. Título */}
                      <TableCell sx={{ fontWeight: 700, color: '#1e3a5f' }}>
                        {book.title}
                      </TableCell>

                      {/* 3. Autor */}
                      <TableCell sx={{ color: '#475569' }}>
                        {book.author}
                      </TableCell>

                      {/* 4. Vendedor */}
                      <TableCell>
                        <Chip
                          icon={<StorefrontIcon sx={{ fontSize: '16px !important' }} />}
                          label={book.seller}
                          size="small"
                          sx={{ backgroundColor: '#e2e8f0', color: '#1e3a5f', fontWeight: 600 }}
                        />
                      </TableCell>

                      {/* 5. Precio */}
                      <TableCell sx={{ fontWeight: 700, color: '#059669' }}>
                        ${typeof book.price === 'number' ? book.price.toFixed(2) : book.price}
                      </TableCell>

                      {/* 6. Acciones */}
                      <TableCell align="center">
                        <Tooltip title="Editar">
                          <IconButton disabled={busy} aria-label={'Editar ' + book.title} onClick={() => handleOpenEdit(book)} sx={{ color: '#2563eb', mr: 1 }}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                          <IconButton disabled={busy} aria-label={'Eliminar ' + book.title} onClick={() => handleDelete(book.id)} sx={{ color: '#dc2626' }}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>

                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

      </Container>

      <Dialog open={categoryModal} onClose={() => { if (!savingCategory) setCategoryModal(false); }}
        aria-labelledby="category-dialog-title" maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle id="category-dialog-title" sx={{ backgroundColor: '#1e3a5f', color: 'white' }}>Crear categoría</DialogTitle>
        <Box component="form" onSubmit={handleSaveCategory} noValidate>
          <DialogContent sx={{ p: 3 }}>
            {categoryError && <Alert severity="error" sx={{ mb: 2 }}>{categoryError}</Alert>}
            <TextField autoFocus required fullWidth label="Nombre" value={categoryName} disabled={savingCategory}
              onChange={(event) => setCategoryName(event.target.value)} />
          </DialogContent>
          <DialogActions sx={{ p: 2, px: 3 }}>
            <Button disabled={savingCategory} onClick={() => setCategoryModal(false)} color="inherit">Cancelar</Button>
            <Button disabled={savingCategory} type="submit" variant="contained" sx={{ backgroundColor: '#1e3a5f' }}>
              {savingCategory ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* MODAL AGREGAR / EDITAR */}
      <Dialog open={openModal} onClose={() => { if (!busy) setOpenModal(false); }} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ backgroundColor: '#1e3a5f', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography fontWeight="bold">{editingBook ? 'Editar Libro' : 'Agregar Nuevo Libro'}</Typography>
          <IconButton disabled={busy} onClick={() => setOpenModal(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Box component="form" onSubmit={handleSave}>
          <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField select required label="Categoría" value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}>
              {categories.map((c) => <MenuItem key={c._id} value={c._id}>{c.nombre}</MenuItem>)}
            </TextField>
            <TextField label="Stock" type="number" required value={formData.stock} slotProps={{ htmlInput: { min: 0, step: 1 } }} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} />
            <TextField select label="Encuadernación" value={formData.tipoTapa} onChange={(e) => setFormData({ ...formData, tipoTapa: e.target.value })}>
              <MenuItem value="blanda">Tapa blanda</MenuItem><MenuItem value="dura">Tapa dura</MenuItem>
            </TextField>
            <TextField select label="Disponibilidad" value={String(formData.disponibilidad)} onChange={(e) => setFormData({ ...formData, disponibilidad: e.target.value === 'true' })}>
              <MenuItem value="true">Disponible</MenuItem><MenuItem value="false">No disponible</MenuItem>
            </TextField>
            <TextField
              label="Título del Libro"
              fullWidth
              size="small"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
            <TextField
              label="Autor"
              fullWidth
              size="small"
              required
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
            />
            <TextField
              label="Nombre del Vendedor / Tienda"
              fullWidth
              size="small"
              required
              disabled
              value={formData.seller}
              onChange={(e) => setFormData({ ...formData, seller: e.target.value })}
            />
            <TextField
              label="Precio ($ MXN)"
              type="number"
              fullWidth
              size="small"
              required
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            />
            <TextField
              label="URL de la Portada (Imagen)"
              fullWidth
              size="small"
              placeholder="https://..."
              value={formData.cover}
              onChange={(e) => setFormData({ ...formData, cover: e.target.value })}
            />
          </DialogContent>

          <DialogActions sx={{ p: 2, px: 3 }}>
            <Button disabled={busy} onClick={() => setOpenModal(false)} color="inherit">
              Cancelar
            </Button>
            <Button disabled={busy} type="submit" variant="contained" sx={{ backgroundColor: '#1e3a5f' }}>
              {editingBook ? 'Guardar Cambios' : 'Agregar'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
