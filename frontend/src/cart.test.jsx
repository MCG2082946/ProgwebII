import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import useCart from './useCart';

afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); });
const book = { _id: 'book', titulo: 'Libro persistente', autor: 'Autora', precio: 12.5,
  stock: 6, disponibilidad: true, categoria: 'cat', tipoTapa: 'blanda' };
const account = (id) => ({ id, nombre: 'Cuenta ' + id, rol: 'cliente', email: id + '@example.com' });
const response = (data, ok = true, status = ok ? 200 : 409) => ({ ok, status, json: async () => data });
const data = (cantidad = 0, libro = book, disponible = true) => ({
  items: cantidad ? [{ id_libro: book._id, cantidad, libro, disponible, subtotal: disponible ? cantidad * book.precio : 0,
    motivo: disponible ? null : 'Este libro fue retirado del catálogo.' }] : [],
  total: disponible ? cantidad * book.precio : 0,
});
function service(initial = { a: 2, b: 0 }) {
  const stored = { ...initial };
  let active = 'a';
  const fetchMock = vi.fn(async (url, options = {}) => {
    const id = options.headers?.Authorization?.replace('Bearer token-', '') || active;
    if (url.endsWith('/auth/me')) return response({ usuario: account(id) });
    if (url.endsWith('/auth/login')) {
      active = JSON.parse(options.body).email.split('@')[0];
      return response({ usuario: account(active), token: 'token-' + active });
    }
    if (url.endsWith('/categories')) return response([{ _id: 'cat', nombre: 'Novela' }]);
    if (url.endsWith('/books')) return response([book]);
    if (url.includes('/cart')) {
      expect(options.headers.Authorization).toBe('Bearer token-' + id);
      if (options.method === 'POST') {
        expect(JSON.parse(options.body)).toEqual({ id_libro: 'book', cantidad: 1 }); stored[id] += 1;
      } else if (options.method === 'PATCH') stored[id] = JSON.parse(options.body).cantidad;
      else if (options.method === 'DELETE') stored[id] = 0;
      return response(data(stored[id]));
    }
    throw new Error('Unexpected route ' + url);
  });
  vi.stubGlobal('fetch', fetchMock); localStorage.setItem('token', 'token-a');
  return { stored, fetchMock };
}
const mount = () => render(<MemoryRouter><App /></MemoryRouter>);
const drawer = () => within(screen.getByRole('region', { name: 'Carrito de compras' }));

test.each([false, true])('stock changed with checkout already open = %s refreshes the cart and allows removal', async (alreadyOpen) => {
  let stock = 6;
  let quantity = 0;
  const title = book.titulo;
  const message = `«${title}» está agotado. Elimínalo del carrito para continuar.`;
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url.endsWith('/auth/me')) return response({ usuario: account('a') });
    if (url.endsWith('/books')) return response([{ ...book, stock }]);
    if (url.endsWith('/orders') && options.method === 'POST') return response({ mensaje: message }, false);
    if (url.includes('/cart')) {
      if (options.method === 'POST') quantity += 1;
      if (options.method === 'DELETE') quantity = 0;
      const cart = data(quantity, { ...book, stock }, stock > 0);
      if (stock === 0 && quantity) cart.items[0].motivo = 'Agotado. Elimínalo para continuar.';
      return response(cart);
    }
    return response([]);
  });
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('token', 'token-a');
  const user = userEvent.setup();
  mount();
  await user.click((await screen.findAllByRole('button', { name: 'Añadir al carrito' }))[0]);
  await waitFor(() => expect(quantity).toBe(1));
  await user.click(screen.getByRole('button', { name: 'Carrito' }));
  await waitFor(() => expect(drawer().getByRole('button', { name: 'Realizar Compra' }).disabled).toBe(false));
  if (!alreadyOpen) stock = 0;
  await user.click(drawer().getByRole('button', { name: 'Realizar Compra' }));
  if (alreadyOpen) {
    await user.click(await screen.findByRole('radio', { name: 'Transferencia SPEI' }));
    stock = 0;
    const confirm = screen.getByRole('button', { name: 'Registrar pedido' });
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);
    expect(await within(confirm.closest('[role="dialog"]')).findByText(message)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Volver al carrito' }));
  }
  expect(quantity).toBe(1);
  expect(await drawer().findByText(/Agotado\. Elimínalo para continuar/)).toBeTruthy();
  expect(drawer().getByRole('button', { name: 'Realizar Compra' }).disabled).toBe(true);
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/orders'))).toHaveLength(alreadyOpen ? 1 : 0);
  await user.click(drawer().getByRole('button', { name: 'Eliminar ' + title }));
  expect(await drawer().findByText('Tu carrito está vacío.')).toBeTruthy();
}, 10000);

test('restaura desde API; agrega sin duplicar, modifica, elimina, recarga y separa sesiones sin borrar MongoDB', async () => {
  const { stored, fetchMock } = service();
  const user = userEvent.setup(); let view = mount();
  await user.click(await screen.findByRole('button', { name: 'Carrito' }));
  await drawer().findByText('2 artículos');
  expect(drawer().getByText('$25.00')).toBeTruthy();
  expect(drawer().getAllByText('Libro persistente')).toHaveLength(1);
  await user.click(drawer().getByRole('button', { name: 'Aumentar cantidad de Libro persistente' }));
  await drawer().findByText('3 artículos');
  await user.click(drawer().getByRole('button', { name: 'Reducir cantidad de Libro persistente' }));
  await drawer().findByText('2 artículos');
  await user.click(drawer().getByRole('button', { name: 'Eliminar Libro persistente' }));
  await drawer().findByText('Tu carrito está vacío.');
  await user.click(drawer().getByRole('button', { name: 'Cerrar carrito' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Carrito de compras' })).toBeNull());
  for (let i = 0; i < 2; i += 1) {
    await user.click((await screen.findAllByRole('button', { name: 'Añadir al carrito' }))[0]);
    await waitFor(() => expect(stored.a).toBe(i + 1));
  }
  await waitFor(() => expect(within(screen.getByRole('button', { name: 'Carrito' })).getByText('2')).toBeTruthy());
  view.unmount(); view = mount();
  await user.click(await screen.findByRole('button', { name: 'Carrito' }));
  await drawer().findByText('2 artículos');
  expect(drawer().getAllByText('Libro persistente')).toHaveLength(1);
  expect(drawer().getByRole('button', { name: 'Realizar Compra' }).disabled).toBe(false);
  await user.click(drawer().getByRole('button', { name: 'Cerrar carrito' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Carrito de compras' })).toBeNull());
  await user.click(screen.getByRole('button', { name: 'Mi cuenta' }));
  await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await user.click(await screen.findByRole('button', { name: 'Iniciar sesión' }));
  await user.type(screen.getByLabelText(/Correo Electrónico/), 'b@example.com');
  await user.type(screen.getByLabelText(/Contraseña/), 'password123');
  await user.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
  await user.click(await screen.findByRole('button', { name: 'Carrito' }));
  await drawer().findByText('Tu carrito está vacío.');
  expect(drawer().queryByText('Libro persistente')).toBeNull();
  expect(stored.a).toBe(2); expect(stored.b).toBe(0);
  expect(fetchMock.mock.calls.filter(([url, options]) => url.endsWith('/cart') && !options.method).length).toBeGreaterThanOrEqual(3);
}, 15000);

test('visitante recibe indicación de iniciar sesión sin escrituras al carrito', async () => {
  const { fetchMock } = service(); localStorage.removeItem('token');
  const user = userEvent.setup(); mount();
  await user.click((await screen.findAllByRole('button', { name: 'Añadir al carrito' }))[0]);
  await screen.findByText('Debes iniciar sesión para añadir productos al carrito');
  expect(screen.getByRole('button', { name: 'Iniciar Sesión' })).toBeTruthy();
  expect(fetchMock.mock.calls.some(([url]) => url.includes('/cart'))).toBe(false);
});

test('errores de carga y guardado no fabrican datos y permiten consultar de nuevo antes de modificar', async () => {
  let failLoad = true, finish;
  const fetchMock = vi.fn(async (url, options) => {
    if (options.method) return new Promise((resolve) => { finish = resolve; });
    if (failLoad) throw new Error('Carrito no disponible');
    return response(data(2));
  });
  vi.stubGlobal('fetch', fetchMock); localStorage.setItem('token', 'token-a');
  const { result } = renderHook(() => useCart(account('a')));
  await waitFor(() => expect(result.current.error).toBe('Carrito no disponible'));
  expect(result.current.items).toEqual([]); expect(result.current.total).toBe(0);
  failLoad = false;
  await act(async () => { await result.current.reload(); });
  expect(result.current.total).toBe(25);
  let change;
  act(() => { change = result.current.change('book', 3); });
  expect(result.current.busy).toBe(true); expect(result.current.items[0].quantity).toBe(2);
  await act(async () => { await result.current.change('book', 4); });
  expect(fetchMock.mock.calls.filter(([, options]) => options.method)).toHaveLength(1);
  await act(async () => { finish(response({ mensaje: 'Stock insuficiente' }, false)); await change; });
  expect(result.current.error).toBe('Stock insuficiente'); expect(result.current.total).toBe(25);
  await act(async () => { expect(await result.current.add('book')).toBe(false); });
  await act(async () => { await result.current.reload(); });
  expect(result.current.error).toBe('');
});

test('respuesta tardía de A nunca reemplaza carrito de B ni vuelve a mostrarlo al cerrar sesión', async () => {
  let finishA;
  vi.stubGlobal('fetch', vi.fn((url, options) => options.headers.Authorization === 'Bearer token-a'
    ? new Promise((resolve) => { finishA = resolve; }) : Promise.resolve(response(data(1)))));
  localStorage.setItem('token', 'token-a');
  const { result, rerender } = renderHook(({ user }) => useCart(user), { initialProps: { user: account('a') } });
  expect(result.current.loading).toBe(true);
  localStorage.setItem('token', 'token-b'); rerender({ user: account('b') });
  await waitFor(() => expect(result.current.items[0]?.quantity).toBe(1));
  await act(async () => { finishA(response(data(5))); });
  expect(result.current.items[0].quantity).toBe(1);
  rerender({ user: null }); expect(result.current.items).toEqual([]); expect(result.current.total).toBe(0);
});

test('libro eliminado permanece visible, sin total, y se puede quitar desde el drawer', async () => {
  const { fetchMock } = service();
  fetchMock.mockImplementation(async (url, options) => {
    if (url.endsWith('/auth/me')) return response({ usuario: account('a') });
    if (url.endsWith('/categories') || url.endsWith('/books')) return response([]);
    return response(options.method === 'DELETE' ? data() : data(2, null, false));
  });
  const user = userEvent.setup(); mount();
  await user.click(await screen.findByRole('button', { name: 'Carrito' }));
  await drawer().findByText('Libro retirado del catálogo');
  expect(drawer().getByText('$0.00')).toBeTruthy();
  expect(drawer().getByRole('button', { name: 'Aumentar cantidad de Libro retirado del catálogo' }).disabled).toBe(true);
  await user.click(drawer().getByRole('button', { name: 'Eliminar Libro retirado del catálogo' }));
  await drawer().findByText('Tu carrito está vacío.');
});

test('si el stock bajó, Reducir ajusta a las existencias actuales sin bloquearse en una cantidad inválida', async () => {
  const { fetchMock } = service();
  fetchMock.mockImplementation(async (url, options) => {
    if (url.endsWith('/auth/me')) return response({ usuario: account('a') });
    if (url.endsWith('/categories') || url.endsWith('/books')) return response([]);
    if (options.method === 'PATCH') {
      expect(JSON.parse(options.body)).toEqual({ cantidad: 2 });
      return response(data(2, { ...book, stock: 2 }));
    }
    return response(data(4, { ...book, stock: 2 }, false));
  });
  const user = userEvent.setup(); mount();
  await user.click(await screen.findByRole('button', { name: 'Carrito' }));
  await drawer().findByText('4 artículos');
  await user.click(drawer().getByRole('button', { name: 'Reducir cantidad de Libro persistente' }));
  await drawer().findByText('2 artículos');
  expect(drawer().getByText('$25.00')).toBeTruthy();
});
