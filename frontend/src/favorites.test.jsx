import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Inicio from './Inicio';
import useFavorites from './useFavorites';

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
const book = { _id: 'book', titulo: 'Libro favorito', autor: 'Autora', precio: 12, stock: 5, disponibilidad: true, tipoTapa: 'blanda' };
const account = (id) => ({ id, nombre: 'Cuenta ' + id, email: id + '@example.com', rol: 'cliente' });
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
const list = (ids) => ids.map((id) => ({ id_libro: id, libro: { ...book, _id: id } }));
function service() {
  const lists = { a: new Set(), b: new Set() };
  const fetchMock = vi.fn(async (url, options = {}) => {
    const owner = options.headers?.Authorization?.replace('Bearer token-', '') || 'a';
    if (url.endsWith('/books')) return response([book]);
    if (url.endsWith('/categories')) return response([]);
    if (url.endsWith('/cart')) return response({ items: [], total: 0 });
    if (url.endsWith('/orders')) return response([]);
    if (url.includes('/favorites/')) {
      const id = url.split('/').pop();
      if (options.method === 'PUT') lists[owner].add(id);
      else if (options.method === 'DELETE') lists[owner].delete(id);
      else throw new Error('Unexpected mutation');
      return response(null, 204);
    }
    if (url.endsWith('/favorites')) return response(list([...lists[owner]]));
    throw new Error('Unexpected URL ' + url);
  });
  vi.stubGlobal('fetch', fetchMock); localStorage.setItem('token', 'token-a');
  return { lists, fetchMock };
}
test('save and remove use API; login/remount restores favorites separately for two accounts and logout only clears UI', async () => {
  const { lists, fetchMock } = service();
  let view = renderHook(({ user }) => useFavorites(user), { initialProps: { user: account('a') } });
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  await act(async () => { await view.result.current.save('book'); });
  expect(view.result.current.has('book')).toBe(true);
  await act(async () => { await view.result.current.save('book'); });
  expect(lists.a.size).toBe(1);
  view.rerender({ user: null }); expect(view.result.current.items).toEqual([]); expect(lists.a.size).toBe(1);
  localStorage.setItem('token', 'token-b'); view.rerender({ user: account('b') });
  await waitFor(() => expect(view.result.current.loading).toBe(false)); expect(view.result.current.items).toEqual([]);
  await act(async () => { await view.result.current.save('other'); });
  view.unmount(); localStorage.setItem('token', 'token-a');
  view = renderHook(() => useFavorites(account('a')));
  await waitFor(() => expect(view.result.current.has('book')).toBe(true));
  await act(async () => { await view.result.current.remove('book'); });
  expect(view.result.current.items).toEqual([]); expect(lists.b.has('other')).toBe(true);
  expect(fetchMock.mock.calls.some(([, options]) => options.method === 'DELETE')).toBe(true);
});
test('late response from previous account never replaces the new account list', async () => {
  let finish;
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
    .mockResolvedValue(response(list(['b-book']))));
  const view = renderHook(({ user }) => useFavorites(user), { initialProps: { user: account('a') } });
  view.rerender({ user: account('b') });
  await waitFor(() => expect(view.result.current.has('b-book')).toBe(true));
  await act(async () => { finish(response(list(['a-book']))); });
  expect(view.result.current.has('a-book')).toBe(false);
});
test('catalog and profile synchronize without reload, remove from profile clears both catalog controls', async () => {
  service(); const user = userEvent.setup();
  render(<MemoryRouter><Inicio user={account('a')} setUser={() => {}} onLogout={() => {}} /></MemoryRouter>);
  const save = await screen.findAllByRole('button', { name: 'Guardar en favoritos Libro favorito' });
  await waitFor(() => expect(save[0].disabled).toBe(false)); await user.click(save[0]);
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Quitar de favoritos Libro favorito' })).toHaveLength(2));
  expect(screen.getAllByRole('button', { name: 'Quitar de favoritos Libro favorito' })[1].getAttribute('aria-pressed')).toBe('true');
  await user.click(screen.getAllByText('Libro favorito')[0]);
  const detail = within(screen.getByRole('dialog'));
  expect(detail.getByRole('button', { name: 'Quitar de favoritos Libro favorito' }).getAttribute('aria-pressed')).toBe('true');
  await user.click(detail.getByRole('button', { name: 'Quitar de favoritos Libro favorito' }));
  const saveInDetail = await detail.findByRole('button', { name: 'Guardar en favoritos Libro favorito' });
  await user.click(saveInDetail);
  await detail.findByRole('button', { name: 'Quitar de favoritos Libro favorito' });
  await user.click(detail.getByRole('button', { name: 'Cerrar detalle' }));
  await user.click(await screen.findByRole('button', { name: 'Mi cuenta' }));
  await user.click(screen.getByRole('tab', { name: 'Deseados y Comprados' }));
  const profile = within(screen.getByRole('dialog', { name: 'Mi perfil' }));
  expect(profile.getByText('Lista de Deseos (1)')).toBeTruthy();
  await user.click(profile.getByRole('button', { name: 'Quitar de favoritos Libro favorito' }));
  await profile.findByText('No tienes productos en tu lista de deseos.');
  await user.click(profile.getByRole('button', { name: 'Cerrar perfil' }));
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Guardar en favoritos Libro favorito' })).toHaveLength(2));
});
test('guest is prompted to log in without writing favorites', async () => {
  const { fetchMock } = service(); const user = userEvent.setup();
  render(<MemoryRouter><Inicio user={null} setUser={() => {}} onLogout={() => {}} /></MemoryRouter>);
  await user.click((await screen.findAllByRole('button', { name: 'Guardar en favoritos Libro favorito' }))[0]);
  expect(await screen.findByText('Inicia sesión para guardar favoritos.')).toBeTruthy();
  expect(fetchMock.mock.calls.some(([url]) => url.includes('/favorites'))).toBe(false);
});
test('favorite errors remain visible in detail and retry reloads confirmed state', async () => {
  const { fetchMock } = service(); const user = userEvent.setup();
  const normal = fetchMock.getMockImplementation();
  fetchMock.mockImplementation((url, options = {}) => options.method === 'PUT'
    ? Promise.resolve(response({ mensaje: 'No se pudo guardar favorito' }, 500)) : normal(url, options));
  render(<MemoryRouter><Inicio user={account('a')} setUser={() => {}} onLogout={() => {}} /></MemoryRouter>);
  await screen.findAllByRole('button', { name: 'Guardar en favoritos Libro favorito' });
  await user.click(screen.getAllByText('Libro favorito')[0]);
  const detail = within(screen.getByRole('dialog'));
  const save = detail.getByRole('button', { name: 'Guardar en favoritos Libro favorito' });
  await waitFor(() => expect(save.disabled).toBe(false));
  await user.click(save);
  expect(await detail.findByText('No se pudo guardar favorito')).toBeTruthy();
  expect(save.disabled).toBe(true);
  await user.click(detail.getByRole('button', { name: 'Reintentar favoritos' }));
  await waitFor(() => expect(save.disabled).toBe(false));
  expect(detail.queryByRole('alert')).toBeNull();
});
test('API failure has error state and no example fallback; failed removal keeps the saved list', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ mensaje: 'Sin conexión' }, 500)));
  const view = renderHook(() => useFavorites(account('a')));
  await waitFor(() => expect(view.result.current.error).toBe('Sin conexión'));
  expect(view.result.current.items).toEqual([]);
  fetch.mockResolvedValue(response(list(['book'])));
  await act(async () => { await view.result.current.reload(); });
  fetch.mockResolvedValue(response({ mensaje: 'No guardado' }, 500));
  await act(async () => { await view.result.current.remove('book'); });
  expect(view.result.current.has('book')).toBe(true); expect(view.result.current.error).toBe('No guardado');
});
