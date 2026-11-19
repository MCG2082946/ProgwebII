import { Box, Button, Container, Link, Paper, Stack, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom';
import logo from '../assets/logo.png';

export const storePages = {
  'acerca-de': { title: 'Acerca de', text: [
    'Navegante de Páginas reúne un catálogo de libros que puedes buscar por título o autor y filtrar por categoría, encuadernación y precio.',
    'Con una cuenta puedes guardar libros en la Lista de deseos, preparar un carrito y consultar tus pedidos por folio en Mi perfil. Las cuentas habilitadas como vendedor pueden abrir su panel desde Mi perfil para gestionar sus libros y consultar sus reportes.',
  ] },
  prensa: { title: 'Prensa', text: [
    'Navegante de Páginas es un proyecto de librería web con catálogo, cuentas de cliente y herramientas para vendedores.',
  ], brand: true },
  legal: { title: 'Información legal', text: [
    'Navegante de Páginas es el nombre que identifica este proyecto de librería web.',
    'La información pública del proyecto aún no identifica al operador legal ni proporciona domicilio o contacto para consultas legales.',
  ] },
  privacidad: { title: 'Aviso de privacidad', text: [
    'La cuenta guarda tu nombre, apellidos y correo. La contraseña se guarda como hash.',
    'La tienda usa los datos de la cuenta para iniciar sesión, guardar favoritos y carrito, y mostrar tus pedidos. Los vendedores consultan los datos de sus libros y totales de pedidos sin información personal de clientes.',
    'Los datos introducidos en el formulario de tarjeta se validan en el navegador y no se envían al servidor.',
  ] },
  terminos: { title: 'Términos de servicio', text: [
    'Necesitas una cuenta para guardar favoritos y hacer pedidos. El catálogo muestra los datos y existencias registrados para cada libro. El servidor comprueba la disponibilidad y calcula el total al registrar el pedido.',
    'La confirmación muestra el folio y el estado que puedes consultar en Mis pedidos. Con tarjeta, el formulario comprueba el formato y la tienda registra la confirmación sin efectuar un cargo. SPEI y efectivo quedan pendientes de pago.',
  ] },
  almacenamiento: { title: 'Cookies y almacenamiento', text: [
    'La tienda guarda el token de sesión en localStorage y lo retira al cerrar sesión. Usa sessionStorage para recuperar una compra pendiente sin duplicarla.',
    'El código de la tienda no instala cookies propias.',
  ] },
};

export default function StoreInformation() {
  const { page } = useParams();
  const info = Object.hasOwn(storePages, page) && storePages[page];
  if (!info) return <Navigate to="/" replace />;
  return <Box component="main" sx={{ minHeight: '100vh', bgcolor: '#f4f7f9', py: { xs: 3, md: 6 } }}>
    <Container maxWidth="sm">
      <Button component={RouterLink} to="/" startIcon={<ArrowBack />} sx={{ color: '#1e3a5f', textTransform: 'none', mb: 2 }}>
        Volver a la tienda
      </Button>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h4" component="h1" sx={{ color: '#1e3a5f', fontWeight: 700 }}>{info.title}</Typography>
          {info.text.map((paragraph) => <Typography key={paragraph}>{paragraph}</Typography>)}
          {info.brand && <Box>
            <Box component="img" src={logo} alt="Logo de Navegante de Páginas" sx={{ width: 120, maxWidth: '100%', display: 'block', mb: 1 }} />
            <Link href={logo} download="navegante-de-paginas.png">Descargar logotipo</Link>
          </Box>}
        </Stack>
      </Paper>
    </Container>
  </Box>;
}
