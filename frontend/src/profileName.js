export const nameFields = ['nombres', 'primerApellido', 'segundoApellido', 'sinSegundoApellido'];
const normalize = (value) => typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/gu, ' ') : value;
const pattern = /^\p{L}[\p{L}\p{M}]*(?:[ '\u2019\u02bc\-\u2010\u2011][\p{L}][\p{L}\p{M}]*)*$/u;
export function validateName(input) {
  const data = Object.fromEntries(nameFields.map((key) => [key, normalize(input[key])]));
  const errors = {};
  for (const key of ['nombres', 'primerApellido', 'segundoApellido']) {
    if (key === 'segundoApellido' && data.sinSegundoApellido === true && data[key] === '') continue;
    if (typeof data[key] !== 'string' || !data[key] || data[key].length > 80 || !pattern.test(data[key])) {
      errors[key] = 'Indica un nombre o apellido válido de hasta 80 caracteres, sin números ni símbolos.';
    }
  }
  if (typeof data.sinSegundoApellido !== 'boolean') errors.sinSegundoApellido = 'Indica si tienes segundo apellido.';
  if (data.sinSegundoApellido === true && data.segundoApellido !== '') {
    errors.segundoApellido = 'No puedes indicar un segundo apellido y marcar que no lo tienes.';
  }
  return { data, errors, valid: Object.keys(errors).length === 0 };
}
