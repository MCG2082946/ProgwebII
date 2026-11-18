import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CartDrawer from './components/CartDrawer';
import UserProfileModal from './components/UserProfileModal';
import CheckoutDialog from './components/CheckoutDialog';
import useCart from './useCart';
import { validateCard } from './paymentDemo';
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); });
const item = { id: 'book', title: 'Libro de prueba', quantity: 2, price: 10, available: true, stock: 5 };
const props = { open: true, authenticated: true, cartItems: [item], totalPrice: 20, onClose() {} };
const currentExpiry = () => {
  const now = new Date();
  return String(now.getMonth() + 1).padStart(2, '0') + String(now.getFullYear()).slice(-2);
};
async function fillCard(user) {
  await user.type(screen.getByLabelText('Nombre del titular'), 'Ángela D’Ávila');
  await user.click(screen.getByLabelText('Número de tarjeta'));
  await user.paste('4111 1111 1111 1111');
  await user.type(screen.getByLabelText('Vencimiento MM/AA'), currentExpiry());
  await user.type(screen.getByLabelText('Código de seguridad'), '012');
}
test('manual entry and double click send one confirmation showing the order folio', async () => {
  const user = userEvent.setup(); let finish;
  const checkout = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
  render(<CartDrawer {...props} onCheckout={checkout} />);
  await user.click(screen.getByRole('button', { name: 'Realizar Compra' }));
  expect(screen.getByRole('heading', { name: 'Finalizar compra' })).toBeTruthy();
  expect(screen.getAllByRole('radio').map((radio) => radio.value)).toEqual(['tarjeta', 'spei', 'efectivo']);
  await fillCard(user);
  expect(screen.getByLabelText('Vencimiento MM/AA').value.replace('/', '')).toBe(currentExpiry());
  expect(screen.getByLabelText('Vencimiento MM/AA').value).toMatch(/^\d{2}\/\d{2}$/);
  await user.dblClick(screen.getByRole('button', { name: 'Confirmar pedido' }));
  expect(checkout).toHaveBeenCalledTimes(1);
  finish({ _id: 'pedido-123', folio: 'LIB-7K4M2P', total: 20, createdAt: new Date().toISOString(), estado: 'pago_aprobado_demo' });
  expect(await screen.findByRole('heading', { name: 'Pedido confirmado' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'LIB-7K4M2P' })).toBeTruthy();
  expect(checkout.mock.calls[0][1]).toBe('tarjeta');
  expect(checkout.mock.calls[0]).toHaveLength(2);
});
test('failed confirmation retains items and reuses idempotency key on retry', async () => {
  const user = userEvent.setup(); const checkout = vi.fn().mockRejectedValueOnce(new Error('No confirmado')).mockResolvedValue({ _id: 'ok', total: 20 });
  render(<CartDrawer {...props} onCheckout={checkout} />);
  await user.click(screen.getByRole('button', { name: 'Realizar Compra' }));
  await fillCard(user);
  await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
  expect(await screen.findByText('No confirmado')).toBeTruthy();
  expect(screen.getAllByText('Libro de prueba').length).toBeGreaterThan(0);
  await fillCard(user);
  await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
  expect(checkout.mock.calls[0][0]).toBe(checkout.mock.calls[1][0]);
});
test('card validates Luhn, exact lengths, titular characters and non-expired months', () => {
  const now = new Date(2026, 10, 17);
  const valid = { holder: "  Léa-O'Neil  ", number: '4111111111111111', expiry: '11/26', code: '012' };
  expect(validateCard(valid, now)).toEqual({});
  for (const [field, values] of Object.entries({
    holder: ['', '  ', '12345', 'Eva3', '---'],
    number: ['411111111111111', '41111111111111112', '4111111111111112', '4111-1111-1111-1111'],
    expiry: ['00/29', '13/29', '1/29', '11/25', '10/26'], code: ['', '01', '01a', '0123'],
  })) {
    for (const value of values) expect(validateCard({ ...valid, [field]: value }, now)[field]).toBeTruthy();
  }
  expect(validateCard({ ...valid, holder: 'Luz', expiry: '12/26', number: '4012 8888 8888 1881', code: '987' }, now)).toEqual({});
});
test('invalid card fields show inline errors and do not create orders', async () => {
  const user = userEvent.setup(); const checkout = vi.fn();
  render(<CheckoutDialog items={[item]} total={20} canBuy onClose={() => {}} onCheckout={checkout} />);
  await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
  expect(screen.getByText('Indica el nombre del titular.')).toBeTruthy();
  expect(screen.getByText('Introduce exactamente 16 dígitos.')).toBeTruthy();
  expect(screen.getByText('Indica un vencimiento válido en formato MM/AA.')).toBeTruthy();
  expect(screen.getByText('Introduce un código de seguridad de tres dígitos.')).toBeTruthy();
  expect(checkout).not.toHaveBeenCalled();
});
test('only edited fields validate on blur and correcting a field preserves the others', async () => {
  const user = userEvent.setup();
  render(<CheckoutDialog items={[item]} total={20} canBuy onClose={() => {}} onCheckout={vi.fn()} />);
  const holder = screen.getByLabelText('Nombre del titular');
  const number = screen.getByLabelText('Número de tarjeta');
  const expiry = screen.getByLabelText('Vencimiento MM/AA');
  const code = screen.getByLabelText('Código de seguridad');
  for (const field of [number, expiry, code]) expect(field.inputMode).toBe('numeric');
  await user.type(holder, 'Lucía');
  await user.click(number);
  await user.paste('4111 1111 1111 11112');
  expect(number.value).toBe('4111 1111 1111 11112');
  expect(screen.queryByText('Introduce exactamente 16 dígitos.')).toBeNull();
  await user.tab();
  expect(screen.getByText('Introduce exactamente 16 dígitos.')).toBeTruthy();
  await user.tab();
  expect(screen.queryByText('Indica un vencimiento válido en formato MM/AA.')).toBeNull();
  await user.type(code, '012');
  await user.clear(number);
  await user.click(number);
  await user.paste('4012 8888 8888 1881');
  await user.tab();
  expect(screen.queryByText('Introduce exactamente 16 dígitos.')).toBeNull();
  expect(holder.value).toBe('Lucía');
  expect(code.value).toBe('012');
});
for (const method of ['spei', 'efectivo']) test(`${method} only submits after explicit confirmation`, async () => {
  const user = userEvent.setup(); const viewOrders = vi.fn();
  const label = { spei: 'Transferencia SPEI', efectivo: 'Pago en efectivo' }[method];
  const checkout = vi.fn(async () => ({ _id: 'db', folio: 'LIB-7K4M2P', total: 20, metodo_pago: label,
    estado: 'pendiente_pago', referencia_demo: 'DEMO-NO-PAGAR-LIB-7K4M2P' }));
  render(<CheckoutDialog items={[item]} total={20} canBuy onClose={() => {}} onCheckout={checkout} onViewOrders={viewOrders} />);
  await user.click(screen.getByRole('radio', { name: label })); expect(checkout).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Nombre del titular')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Registrar pedido' }));
  expect(await screen.findByRole('heading', { name: 'Pedido registrado' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'LIB-7K4M2P' })).toBeTruthy();
  expect(screen.getByText('Pendiente de pago')).toBeTruthy();
  expect(checkout.mock.calls[0][1]).toBe(method);
  expect(screen.queryByText(/DEMO-NO-PAGAR/)).toBeNull();
  await user.click(await screen.findByRole('button', { name: 'Ver mis pedidos' })); expect(viewOrders).toHaveBeenCalledOnce();
});
test.each(['spei', 'paypal'])('card data stays local with a saved %s checkout', async (savedMethod) => {
  const user = userEvent.setup();
  const retryKey = '11111111-1111-4111-8111-111111111111';
  sessionStorage.setItem('checkout:a', JSON.stringify({ key: retryKey, method: savedMethod }));
  const post = vi.fn(); const account = { id: 'a' };
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    if (url.endsWith('/orders')) {
      expect(Object.keys(JSON.parse(sessionStorage.getItem('checkout:a'))).sort()).toEqual(['key', 'method']);
      post(JSON.parse(options.body));
      return { ok: true, json: async () => ({ folio: 'LIB-7K4M2P', total: 20, estado: 'pago_aprobado_demo' }) };
    }
    return { ok: true, json: async () => ({ items: [{ id_libro: 'book', cantidad: 2, disponible: true, subtotal: 20,
      libro: { _id: 'book', titulo: 'Libro', precio: 10 } }], total: 20 }) };
  }));
  function Checkout() {
    const cart = useCart(account);
    return <CheckoutDialog items={cart.items} total={cart.total} canBuy={!cart.loading && !cart.busy} onCheckout={cart.checkout} onClose={() => {}} />;
  }
  render(<Checkout />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar pedido' }).disabled).toBe(false));
  await fillCard(user);
  await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
  await screen.findByRole('heading', { name: 'LIB-7K4M2P' });
  expect(post).toHaveBeenCalledOnce();
  expect(Object.keys(post.mock.calls[0][0]).sort()).toEqual(['clave_compra', 'metodo_pago']);
  expect(post.mock.calls[0][0].metodo_pago).toBe('tarjeta');
  if (savedMethod === 'paypal') expect(post.mock.calls[0][0].clave_compra).not.toBe(retryKey);
  else expect(post.mock.calls[0][0].clave_compra).toBe(retryKey);
  expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toMatch(/4111|Ángela/);
});
test('history displays persisted folio and payment status and preserves legacy order access', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [
    { _id: 'new', folio: 'LIB-7K4M2P', createdAt: '2026-11-17T12:00:00Z', metodo_pago: 'Transferencia SPEI', estado: 'pendiente_pago',
      referencia_demo: 'DEMO-NO-PAGAR', total: 20, detalles: [{ titulo: 'Libro de prueba', cantidad: 2 }] },
    { _id: 'legacy', createdAt: '2026-01-01T12:00:00Z', metodo_pago: 'Tarjeta de prueba', estado: 'simulado', total: 10, detalles: [] },
    { _id: 'sandbox-order', folio: 'LIB-8K4M2P', createdAt: '2026-11-16T12:00:00Z', metodo_pago: 'PayPal Sandbox', estado: 'paypal_sandbox_aprobado', total: 10, detalles: [] },
  ] })));
  render(<UserProfileModal open initialTab={1} user={{ id: 'a', nombre: 'Ana', email: 'a@example.com' }} onClose={() => {}} />);
  expect(await screen.findByText('Folio: LIB-7K4M2P')).toBeTruthy();
  expect(screen.getByText(/Transferencia SPEI/)).toBeTruthy();
  expect(screen.getByText('Pendiente de pago')).toBeTruthy();
  expect(screen.queryByText(/DEMO-NO-PAGAR/)).toBeNull();
  const detail = screen.getByText('Libros del pedido');
  expect(detail.parentElement.open).toBe(false);
  await userEvent.setup().click(detail);
  expect(detail.parentElement.open).toBe(true);
  expect(screen.getByText('Libro de prueba · Cantidad: 2')).toBeTruthy();
  expect(screen.getByText('Pedido anterior: legacy')).toBeTruthy();
  expect(screen.getByText('Folio: LIB-8K4M2P')).toBeTruthy();
  expect(screen.getByText('Pago aprobado en PayPal Sandbox')).toBeTruthy();
});
test('unavailable item blocks purchase', () => {
  render(<CartDrawer {...props} cartItems={[{ ...item, available: false }]} />);
  expect(screen.getByRole('button', { name: 'Realizar Compra' }).disabled).toBe(true);
});
test('profile loads history from API again after reopening and never falls back to supplied examples', async () => {
  const user = userEvent.setup(); const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [] })); vi.stubGlobal('fetch', fetchMock);
  const account = { id: 'a', nombre: 'Ana', email: 'a@example.com' };
  const view = render(<UserProfileModal open user={account} purchasedBooks={[{ title: 'Fake' }]} />);
  await user.click(screen.getByRole('tab', { name: 'Deseados y Comprados' }));
  await screen.findByText('Aún no has realizado compras.'); expect(screen.queryByText('Fake')).toBeNull();
  view.rerender(<UserProfileModal open={false} user={account} />);
  view.rerender(<UserProfileModal open user={account} />);
  await user.click(screen.getByRole('tab', { name: 'Deseados y Comprados' }));
  await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
});
