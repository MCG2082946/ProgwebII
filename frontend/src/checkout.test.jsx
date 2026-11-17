import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CartDrawer from './components/CartDrawer';
import UserProfileModal from './components/UserProfileModal';
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); });
const item = { id: 'book', title: 'Libro de prueba', quantity: 2, price: 10, available: true, stock: 5 };
const props = { open: true, authenticated: true, cartItems: [item], totalPrice: 20, onClose() {} };
test('summary uses only test card and double click sends one confirmation showing order number', async () => {
  const user = userEvent.setup(); let finish;
  const checkout = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
  render(<CartDrawer {...props} onCheckout={checkout} />);
  await user.click(screen.getByRole('button', { name: 'Realizar Compra' }));
  expect(screen.getByText('Método: Tarjeta de prueba')).toBeTruthy();
  expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  await user.dblClick(screen.getByRole('button', { name: 'Confirmar compra simulada' }));
  expect(checkout).toHaveBeenCalledTimes(1);
  finish({ _id: 'pedido-123' });
  expect(await screen.findByText('Número de pedido: pedido-123')).toBeTruthy();
});
test('failed confirmation retains items and reuses idempotency key on retry', async () => {
  const user = userEvent.setup(); const checkout = vi.fn().mockRejectedValueOnce(new Error('No confirmado')).mockResolvedValue({ _id: 'ok' });
  render(<CartDrawer {...props} onCheckout={checkout} />);
  await user.click(screen.getByRole('button', { name: 'Realizar Compra' }));
  await user.click(screen.getByRole('button', { name: 'Confirmar compra simulada' }));
  expect(await screen.findByText('No confirmado')).toBeTruthy();
  expect(screen.getByText(/Libro de prueba.*2/)).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Confirmar compra simulada' }));
  expect(checkout.mock.calls[0][0]).toBe(checkout.mock.calls[1][0]);
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
