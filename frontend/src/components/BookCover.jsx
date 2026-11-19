import { useState } from 'react';
import { Box, Typography } from '@mui/material';

export default function BookCover({ src, title, height = 190, width = '100%' }) {
  const [failedSource, setFailedSource] = useState(null);
  return <Box sx={{ width, height, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    bgcolor: '#f4f7f9', overflow: 'hidden', borderRadius: 1 }}>
    {src && src !== failedSource
      ? <Box component="img" key={src} src={src} alt={title} referrerPolicy="no-referrer"
        onError={() => setFailedSource(src)}
        sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', minHeight: 0 }} />
      : <Typography variant="caption" color="text.secondary">Sin portada</Typography>}
  </Box>;
}
