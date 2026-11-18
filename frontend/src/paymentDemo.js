export const paymentMethods = {
  tarjeta: 'Tarjeta de crédito o débito',
  spei: 'Transferencia SPEI', efectivo: 'Pago en efectivo',
};
export const emptyCard = () => ({ holder: '', number: '', expiry: '', code: '' });
export const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', currencyDisplay: 'code' });

export function formatExpiry(value) {
  return value.replace(/^([0-9]{2})([0-9]+)$/, '$1/$2');
}

function passesLuhn(number) {
  let sum = 0;
  for (let index = 0; index < number.length; index += 1) {
    const digit = Number(number[index]);
    const weighted = index % 2 === 0 ? digit * 2 : digit;
    sum += weighted > 9 ? weighted - 9 : weighted;
  }
  return sum % 10 === 0;
}
export function validateCard(card, now = new Date()) {
  const errors = {};
  const holder = card.holder.trim();
  if (!holder) errors.holder = 'Indica el nombre del titular.';
  else if (!/\p{L}/u.test(holder) || !/^(?:\p{L}\p{M}*|[\p{Zs}'’-])+$/u.test(holder)) {
    errors.holder = 'Usa solo letras, espacios, guiones y apóstrofos.';
  }
  const number = card.number.replace(/\p{Zs}/gu, '');
  if (!/^[0-9]{16}$/.test(number)) errors.number = 'Introduce exactamente 16 dígitos.';
  else if (!passesLuhn(number)) errors.number = 'Revisa el dígito de control del número.';
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(card.expiry);
  if (!match) errors.expiry = 'Indica un vencimiento válido en formato MM/AA.';
  else if (2000 + Number(match[2]) < now.getFullYear() ||
    (2000 + Number(match[2]) === now.getFullYear() && Number(match[1]) < now.getMonth() + 1)) {
    errors.expiry = 'El vencimiento debe ser del mes actual o posterior.';
  }
  if (!/^[0-9]{3}$/.test(card.code)) errors.code = 'Introduce un código de seguridad de tres dígitos.';
  return errors;
}
export function orderStatus(state) {
  return { paypal_sandbox_aprobado: 'Pago aprobado en PayPal Sandbox', pago_aprobado_demo: 'Confirmado', pendiente_pago: 'Pendiente de pago',
    simulado: 'Registrado', pendiente: 'Pendiente', pagado: 'Pagado', enviado: 'Enviado', entregado: 'Entregado' }[state] || state;
}
