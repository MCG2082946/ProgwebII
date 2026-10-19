//Apartado unicamente para vendedores

import React, { useState } from 'react';
import {
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
  Close as CloseIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const initialInventory = [
  {
    id: 1,
    cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=200',
    title: 'ALAS DE ESTRELLA',
    author: 'ALLISON SAFT',
    seller: 'Shiro Books',
    price: 350.00
  },
  {
    id: 2,
    cover: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=200',
    title: 'El arte de ser nosotros',
    author: 'Inma Rubiales',
    seller: 'Librería Central',
    price: 398.00
  }
];

export default function SellerPanel({ user }) {
  const navigate = useNavigate();
  const [books, setBooks] = useState(initialInventory);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para modal de formulario
  const [openModal, setOpenModal] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    seller: user?.name || 'Mi Tienda',
    price: '',
    cover: ''
  });

  const handleOpenAdd = () => {
    setEditingBook(null);
    setFormData({
      title: '',
      author: '',
      seller: user?.name || 'Mi Tienda',
      price: '',
      cover: ''
    });
    setOpenModal(true);
  };

  const handleOpenEdit = (book) => {
    setEditingBook(book);
    setFormData(book);
    setOpenModal(true);
  };

  const handleDelete = (id) => {
    setBooks(books.filter((b) => b.id !== id));
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (editingBook) {
      setBooks(books.map((b) => (b.id === editingBook.id ? { ...formData, price: parseFloat(formData.price) } : b)));
    } else {
      const newBook = {
        ...formData,
        id: Date.now(),
        price: parseFloat(formData.price) || 0,
        cover: formData.cover || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=200'
      };
      setBooks([...books, newBook]);
    }
    setOpenModal(false);
  };

  const filteredBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.seller.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ backgroundColor: '#f4f7f9', minHeight: '100vh', py: 5 }}>
      <Container maxWidth="lg">
        
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
                      No se encontraron libros en el inventario.
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
                          <IconButton onClick={() => handleOpenEdit(book)} sx={{ color: '#2563eb', mr: 1 }}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                          <IconButton onClick={() => handleDelete(book.id)} sx={{ color: '#dc2626' }}>
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

      {/* MODAL AGREGAR / EDITAR */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ backgroundColor: '#1e3a5f', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography fontWeight="bold">{editingBook ? 'Editar Libro' : 'Agregar Nuevo Libro'}</Typography>
          <IconButton onClick={() => setOpenModal(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Box component="form" onSubmit={handleSave}>
          <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
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
              value={formData.seller}
              onChange={(e) => setFormData({ ...formData, seller: e.target.value })}
            />
            <TextField
              label="Precio ($ MXN)"
              type="number"
              fullWidth
              size="small"
              required
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
            <Button onClick={() => setOpenModal(false)} color="inherit">
              Cancelar
            </Button>
            <Button type="submit" variant="contained" sx={{ backgroundColor: '#1e3a5f' }}>
              {editingBook ? 'Guardar Cambios' : 'Agregar'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}