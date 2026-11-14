import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Snackbar, Alert, Button, Typography, TextField, MenuItem, InputAdornment, Paper } from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

// Componentes
import Navbar from './components/Navbar';
import { loadCatalog } from './api';
import BookSlider from './components/BookSlider';
import BookDetailModal from './components/BookDetailModal';
import CartDrawer from './components/CartDrawer';
import LoginModal from './components/LoginModal';
import UserProfileModal from './components/UserProfileModal';
import Footer from './components/Footer';

// Logotipo de la librería
import logoImg from './assets/logo.png';

export default function Inicio({ user, setUser, onLogout }) {
  const navigate = useNavigate();

  // Catálogo de libros
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    loadCatalog({ signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) { setBooks(data.books); setCategories(data.categories); }
    }).catch((error) => {
      if (!controller.signal.aborted) { setBooks([]); setError(error.message); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  const [purchasedBooks, setPurchasedBooks] = useState([]);

  // Búsqueda y filtros del catálogo
  const [searchTerm, setSearchTerm] = useState('');
  const [bindingFilter, setBindingFilter] = useState('Todas');
  const [priceFilter, setPriceFilter] = useState('Todos');

  const filteredBooks = books.filter((book) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query ||
      book.title.toLowerCase().includes(query) ||
      book.author.toLowerCase().includes(query);

    const matchesBinding = bindingFilter === 'Todas' || book.binding === bindingFilter;

    let matchesPrice = true;
    if (priceFilter === 'Menos de $20') matchesPrice = book.price < 20;
    if (priceFilter === '$20 - $24.99') matchesPrice = book.price >= 20 && book.price < 25;
    if (priceFilter === '$25 o más') matchesPrice = book.price >= 25;

    return matchesSearch && matchesBinding && matchesPrice && (!categoryFilter || book.categoryId === categoryFilter);
  });

  const clearFilters = () => {
    setSearchTerm('');
    setBindingFilter('Todas'); setCategoryFilter('');
    setPriceFilter('Todos');
  };

  // Estados del Carrito
  const [openCart, setOpenCart] = useState(false);
  const [cartItems, setCartItems] = useState([]);

  // Visibilidad de Modales
  const [openLoginModal, setOpenLoginModal] = useState(false);
  const [openProfileModal, setOpenProfileModal] = useState(false);
  const [openDetailModal, setOpenDetailModal] = useState(false);

  // Elemento seleccionado
  const [selectedBook, setSelectedBook] = useState(null);

  // Alertas Toast
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });

  const handleShowToast = (message, severity = 'info') => {
    setToast({ open: true, message, severity });
  };

  const handleCloseToast = () => {
    setToast((prev) => ({ ...prev, open: false }));
  };

  // Login exitoso
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setOpenLoginModal(false);
    handleShowToast(`¡Bienvenido de nuevo, ${userData.nombre || userData.email}!`, 'success');
  };

  // 🔒 VALIDACIÓN RIGUROSA DE PERFIL: Si no hay usuario, abre Login obligatoriamente
  const handleOpenProfileOrLogin = () => {
    if (!user) {
      handleShowToast('Debes iniciar sesión para acceder a tu perfil', 'info');
      setOpenLoginModal(true);
    } else {
      setOpenProfileModal(true);
    }
  };

  // 🔒 VALIDACIÓN DE AÑADIR AL CARRITO
  const handleAddToCart = (book) => {
    if (!user) {
      handleShowToast('Debes iniciar sesión para añadir productos al carrito', 'warning');
      setOpenLoginModal(true);
      return;
    }

    const existing = cartItems.find((item) => item.id === book.id);
    if (existing) {
      setCartItems(cartItems.map((item) => (item.id === book.id ? { ...item, quantity: item.quantity + 1 } : item)));
    } else {
      setCartItems([...cartItems, { ...book, quantity: 1 }]);
    }
    handleShowToast(`"${book.title}" añadido al carrito`, 'success');
  };

  // 🔒 VALIDACIÓN DE PROCESO DE COMPRA (CHECKOUT)
  const handleCheckout = () => {
    if (!user) {
      setOpenCart(false);
      handleShowToast('Debes iniciar sesión para completar tu compra', 'warning');
      setOpenLoginModal(true);
      return;
    }

    if (cartItems.length === 0) {
      handleShowToast('El carrito está vacío', 'info');
      return;
    }

    // Lógica al realizar la compra
    setPurchasedBooks((prev) => [...prev, ...cartItems]);
    setCartItems([]);
    setOpenCart(false);
    handleShowToast('¡Compra realizada con éxito! Revisa tu perfil para ver tus libros.', 'success');
  };

  const handleUpdateQuantity = (id, newQty) => {
    if (newQty <= 0) return handleRemoveItem(id);
    setCartItems(cartItems.map((item) => (item.id === id ? { ...item, quantity: newQty } : item)));
  };

  const handleRemoveItem = (id) => {
    setCartItems(cartItems.filter((item) => item.id !== id));
  };

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#f4f7f9' }}>
      
      {/* Barra superior si es vendedor */}
      {user?.rol === 'vendedor' && (
        <Box 
          sx={{ 
            backgroundColor: '#0f172a', 
            color: 'white', 
            px: { xs: 2, md: 4 }, 
            py: 1, 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
            Sesión iniciada como Vendedor
          </Typography>
          <Button
            size="small"
            variant="contained"
            color="secondary"
            startIcon={<AdminPanelSettingsIcon />}
            onClick={() => navigate('/vendedor')}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Ir al Panel de Vendedor
          </Button>
        </Box>
      )}

      {/* Navbar */}
      <Navbar
        cartCount={totalCartCount}
        logoPath={logoImg}
        onOpenCart={() => setOpenCart(true)}
        onOpenLogin={() => setOpenLoginModal(true)}
        onOpenProfile={handleOpenProfileOrLogin}
        user={user}
        onShowToast={handleShowToast}
      />

      {/* Contenido Principal */}
      <Container maxWidth="xl" sx={{ mt: 4, mb: 6, flexGrow: 1 }}>
        {/* Buscador y filtros */}
        <Paper
          elevation={0}
          sx={{
            mb: 4,
            p: { xs: 2, md: 3 },
            border: '1px solid #dbe3ea',
            borderRadius: 3,
            backgroundColor: '#ffffff'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <FilterAltOutlinedIcon sx={{ color: '#1e3a5f' }} />
            <Typography variant="h6" fontWeight={700} color="#1e3a5f">
              Busca tu próxima lectura
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr 1fr auto' },
              gap: 2,
              alignItems: 'center'
            }}
          >
            <TextField
              fullWidth
              size="small"
              label="Buscar libro o autor"
              placeholder="Ej. Dan Brown, Alas de estrella..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#64748b' }} />
                  </InputAdornment>
                )
              }}
            />

            <TextField
              select
              fullWidth
              size="small"
              label="Encuadernación"
              value={bindingFilter}
              onChange={(e) => setBindingFilter(e.target.value)}
            >
              <MenuItem value="Todas">Todas</MenuItem>
              <MenuItem value="Tapa blanda">Tapa blanda</MenuItem>
              <MenuItem value="Tapa dura">Tapa dura</MenuItem>
              <MenuItem value="Edición especial">Edición especial</MenuItem>
            </TextField>

            <TextField
              select
              fullWidth
              size="small"
              label="Precio"
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value)}
            >
              <MenuItem value="Todos">Todos</MenuItem>
              <MenuItem value="Menos de $20">Menos de $20</MenuItem>
              <MenuItem value="$20 - $24.99">$20 - $24.99</MenuItem>
              <MenuItem value="$25 o más">$25 o más</MenuItem>
            </TextField>

            <TextField select fullWidth size="small" label="Categoría" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <MenuItem value="">Todas</MenuItem>
              {categories.map((c) => <MenuItem key={c._id} value={c._id}>{c.nombre}</MenuItem>)}
            </TextField>
            <Button variant="outlined" startIcon={<RestartAltIcon />}
              onClick={clearFilters}
              sx={{ minHeight: 40, whiteSpace: 'nowrap', textTransform: 'none', borderColor: '#1e3a5f', color: '#1e3a5f' }}
            >
              Limpiar
            </Button>
          </Box>

          <Typography variant="body2" sx={{ mt: 2, color: '#64748b' }}>
            {filteredBooks.length} {filteredBooks.length === 1 ? 'libro encontrado' : 'libros encontrados'}
          </Typography>
        </Paper>

        {loading ? <Typography role="status">Cargando catálogo...</Typography> : error ? (
          <Alert severity="error" action={<Button onClick={() => setReload((n) => n + 1)}>Reintentar</Button>}>{error}</Alert>
        ) : filteredBooks.length > 0 ? (
          <>
        <BookSlider
          title="Libros en Tendencia"
          books={filteredBooks}
          isSeller={false}
          onSelect={(book) => { setSelectedBook(book); setOpenDetailModal(true); }}
          onAddToCart={handleAddToCart}
        />

        <BookSlider
          title="Novedades y Preventas"
          books={[...filteredBooks].reverse()}
          isSeller={false}
          onSelect={(book) => { setSelectedBook(book); setOpenDetailModal(true); }}
          onAddToCart={handleAddToCart}
        />
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
            <SearchIcon sx={{ fontSize: 52, color: '#94a3b8', mb: 1 }} />
            <Typography variant="h6" fontWeight={700} color="#1e3a5f">
              No encontramos libros con esos filtros
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 1, mb: 2 }}>
              Prueba con otro título, autor, tipo de encuadernación o rango de precio.
            </Typography>
            <Button variant="contained" onClick={clearFilters} sx={{ textTransform: 'none', backgroundColor: '#1e3a5f' }}>
              Ver todos los libros
            </Button>
          </Box>
        )}
      </Container>

      {/* Footer */}
      <Footer logoPath={logoImg} /> {/* 👈 Agregado aquí al final */}

      {/* Componentes modulares (Modales, Drawer y Toast) */}
      <CartDrawer
        open={openCart}
        onClose={() => setOpenCart(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
      />

      <LoginModal
        open={openLoginModal}
        onClose={() => setOpenLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
        logoPath={logoImg}
      />

      <UserProfileModal
        open={Boolean(user) && openProfileModal}
        onClose={() => setOpenProfileModal(false)}
        user={user}
        onLogout={onLogout}
        onUpdateUser={(updatedData) => setUser((prev) => ({ ...prev, ...updatedData }))}
        wishlist={books.slice(0, 3)}
        purchasedBooks={purchasedBooks}
      />

      <BookDetailModal
        open={openDetailModal}
        book={selectedBook}
        onClose={() => setOpenDetailModal(false)}
        onAddToCart={handleAddToCart}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseToast} severity={toast.severity} sx={{ width: '100%', borderRadius: 2 }}>
          {toast.message}
        </Alert>
      </Snackbar>

    </Box>
  );
}
