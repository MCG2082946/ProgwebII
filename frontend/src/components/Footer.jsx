// Footer inferior de la pagina

import React from 'react';
import { Box, Container, Typography, Link } from '@mui/material';

export default function Footer() {
  const links = [
    { label: 'Acerca de', href: '#' },
    { label: 'Prensa', href: '#' },
    { label: 'Legal', href: '#' },
    { label: 'Política de privacidad', href: '#' },
    { label: 'Términos de servicio', href: '#' },
    { label: 'Política de las cookies', href: '#' },
  ];

  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: '#1e3a5f',
        color: '#ffffff',
        py: 4,
        mt: 'auto',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <Container maxWidth="xl" sx={{ textAlign: 'center' }}>
        <Box
          className="footer-contenedor"
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            mb: 2,
          }}
        >
          <div className="informacion">
            {links.map((link, index) => (
              <span key={link.label}>
                <Link
                  href={link.href}
                  underline="hover"
                  sx={{
                    color: '#e2e8f0',
                    fontSize: '0.9rem',
                    '&:hover': { color: '#ffffff' },
                  }}
                >
                  {link.label}
                </Link>
                {index < links.length - 1 && (
                  <Typography
                    component="span"
                    sx={{ color: '#94a3b8', mx: 1.5, fontSize: '0.9rem' }}
                  >
                    |
                  </Typography>
                )}
              </span>
            ))}
          </div>
        </Box>

        <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
          &copy; {new Date().getFullYear()} Navegante de Páginas inc. - Todos los derechos reservados
        </Typography>
      </Container>
    </Box>
  );
}