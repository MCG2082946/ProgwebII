import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SellerPanel from './DashboardVendedor';

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
const response = (data, ok = true) => ({ ok, json: async () => data });
const panel = () => render(<MemoryRouter><SellerPanel user={{ nombre: 'Ana', rol: 'vendedor' }} /></MemoryRouter>);

test('creates the first category, prevents duplicate submits and enables it in the book form', async () => {
  let finishSave;
  const fetchMock = vi.fn(async (url, options) => {
    if (options.method === 'POST') {
      expect(url.endsWith('/categories')).toBe(true);
      expect(options.headers.Authorization).toBe('Bearer seller-token');
      expect(JSON.parse(options.body)).toEqual({ nombre: 'Historia' });
      return new Promise((resolve) => { finishSave = resolve; });
    }
    return response([]);
  });
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('token', 'seller-token');
  const user = userEvent.setup();
  panel();
  const addBook = screen.getByRole('button', { name: 'Agregar Libro' });
  await user.click(await screen.findByRole('button', { name: 'Crear categoría' }));
  expect(addBook.disabled).toBe(true);
  const dialog = within(screen.getByRole('dialog'));
  await user.click(dialog.getByRole('button', { name: 'Guardar' }));
  expect(await dialog.findByRole('alert')).toBeTruthy();
  expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(0);
  await user.type(dialog.getByLabelText(/Nombre/), '   ');
  await user.click(dialog.getByRole('button', { name: 'Guardar' }));
  expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(0);
  await user.type(dialog.getByLabelText(/Nombre/), 'Historia ');
  await user.click(dialog.getByRole('button', { name: 'Guardar' }));
  expect(dialog.getByRole('button', { name: 'Guardando...' }).disabled).toBe(true);
  expect(dialog.getByRole('button', { name: 'Cancelar' }).disabled).toBe(true);
  fireEvent.submit(dialog.getByRole('button', { name: 'Guardando...' }).closest('form'));
  expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
  finishSave(response({ categoria: { _id: 'cat', nombre: 'Historia' } }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByRole('button', { name: 'Agregar Libro' }).disabled).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Agregar Libro' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('combobox', { name: /Categoría/ }));
  await user.click(screen.getByRole('option', { name: 'Historia' }));
  expect(within(screen.getByRole('dialog')).getByRole('combobox', { name: /Categoría/ }).textContent).toBe('Historia');
});

test('category load failure offers retry without claiming the list is empty', async () => {
  let failed = true;
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url.endsWith('/categories') && failed) return response({ mensaje: 'No se pudieron cargar las categorías.' }, false);
    return response(url.endsWith('/categories') ? [{ _id: 'cat', nombre: 'Historia' }] : []);
  }));
  const user = userEvent.setup();
  panel();
  await screen.findByText('No se pudieron cargar las categorías.');
  expect(screen.queryByText(/No hay categorías/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Crear categoría' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Agregar Libro' }).disabled).toBe(true);
  failed = false;
  await user.click(screen.getByRole('button', { name: 'Reintentar' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Agregar Libro' }).disabled).toBe(false));
});

test('category save failure preserves the name and permits retry or cancel', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => options.method === 'POST'
    ? response({ mensaje: 'La categoría ya existe.' }, false) : response([])));
  const user = userEvent.setup();
  panel();
  const addBook = screen.getByRole('button', { name: 'Agregar Libro' });
  await user.click(await screen.findByRole('button', { name: 'Crear categoría' }));
  const dialog = within(screen.getByRole('dialog'));
  await user.type(dialog.getByLabelText(/Nombre/), 'Historia');
  await user.click(dialog.getByRole('button', { name: 'Guardar' }));
  expect((await dialog.findByRole('alert')).textContent).toBe('La categoría ya existe.');
  expect(dialog.getByLabelText(/Nombre/).value).toBe('Historia');
  expect(dialog.getByRole('button', { name: 'Guardar' }).disabled).toBe(false);
  expect(addBook.disabled).toBe(true);
  await user.click(dialog.getByRole('button', { name: 'Cancelar' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
