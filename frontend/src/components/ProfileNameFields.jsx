import { Checkbox, FormControlLabel, TextField, Box, FormHelperText } from '@mui/material';

export default function ProfileNameFields({ value, onChange, errors = {}, disabled = false }) {
  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    {Object.entries({ nombres: 'Nombre(s)', primerApellido: 'Primer apellido', segundoApellido: 'Segundo apellido' }).map(([key, label]) =>
      <TextField key={key} label={label} size="small" fullWidth
        required={key !== 'segundoApellido' || !value.sinSegundoApellido}
        disabled={disabled || (key === 'segundoApellido' && value.sinSegundoApellido)}
        value={value[key] ?? ''} onChange={(event) => onChange(key, event.target.value)}
        error={Boolean(errors[key])} helperText={errors[key]} />)}
    <Box>
      <FormControlLabel label="No tengo segundo apellido" control={<Checkbox
        disabled={disabled} checked={value.sinSegundoApellido === true}
        onChange={(event) => onChange('sinSegundoApellido', event.target.checked)} />} />
      {errors.sinSegundoApellido && <FormHelperText error>{errors.sinSegundoApellido}</FormHelperText>}
    </Box>
  </Box>;
}
