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
  const addBook = screen.getByRole('button', { name: 'Agregar libro' });
  await user.click(await screen.findByRole('button', { name: 'Crear categoría' }));
  expect(addBook.disabled).toBe(true);
  const dialog = within(screen.getByRole('dialog'));
  await user.click(dialog.getByRole('button', { name: 'Guardar' }));
  expect(await dialog.findByText(/El nombre es obligatorio/)).toBeTruthy();
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
  expect(screen.getByRole('button', { name: 'Agregar libro' }).disabled).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Agregar libro' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('combobox', { name: /Categoría/ }));
  await user.click(screen.getByRole('option', { name: 'Historia' }));
  expect(within(screen.getByRole('dialog')).getByText('Historia')).toBeTruthy();
});

test('adds a category alongside existing ones without losing the book draft after failure or cancellation', async () => {
  const post = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    if (options.method === 'POST' && url.endsWith('/categories')) {
      return JSON.parse(options.body).nombre === 'Historia'
        ? response({ mensaje: 'La categoría ya existe.' }, false)
        : response({ categoria: { _id: 'travel', nombre: 'Viajes' } });
    }
    if (options.method === 'POST') post(JSON.parse(options.body));
    return response(url.endsWith('/categories') ? [{ _id: 'cat', nombre: 'Historia' }] : []);
  }));
  const user = userEvent.setup();
  panel();
  const add = screen.getByRole('button', { name: 'Agregar libro' });
  await waitFor(() => expect(add.disabled).toBe(false));
  await user.click(add);
  const book = within(screen.getByRole('dialog'));
  await user.click(book.getByRole('combobox', { name: 'Categorías' }));
  await user.click(screen.getByRole('option', { name: 'Historia' }));
  await user.type(book.getByLabelText(/Título del Libro/), 'Borrador');
  await user.type(book.getByLabelText(/Autor/), 'Ana');
  await user.type(book.getByLabelText(/Precio/), '15');
  await user.clear(book.getByLabelText(/Stock/));
  await user.type(book.getByLabelText(/Stock/), '6');
  const open = async () => user.click(await book.findByRole('button', { name: '+ Nueva categoría' }));
  await open();
  const category = () => within(screen.getByRole('dialog', { name: 'Crear categoría' }));
  await user.type(category().getByLabelText(/Nombre/), 'Historia');
  await user.click(category().getByRole('button', { name: 'Guardar' }));
  expect(await category().findByText('La categoría ya existe.')).toBeTruthy();
  await user.click(category().getByRole('button', { name: 'Cancelar' }));
  expect(book.getByLabelText(/Título del Libro/).value).toBe('Borrador');
  await open();
  await user.type(category().getByLabelText(/Nombre/), 'Viajes');
  await user.click(category().getByRole('button', { name: 'Guardar' }));
  expect(await book.findByText('Viajes')).toBeTruthy();
  expect(book.getByText('Historia')).toBeTruthy();
  await user.click(await book.findByRole('button', { name: 'Agregar' }));
  expect(post).toHaveBeenCalledWith(expect.objectContaining({
    titulo: 'Borrador', autor: 'Ana', precio: 15, stock: 6, categoria: ['cat', 'travel'],
  }));
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
  expect(screen.getByRole('button', { name: 'Agregar libro' }).disabled).toBe(true);
  failed = false;
  await user.click(screen.getByRole('button', { name: 'Reintentar' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Agregar libro' }).disabled).toBe(false));
});

test('category save failure preserves the name and permits retry or cancel', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => options.method === 'POST'
    ? response({ mensaje: 'La categoría ya existe.' }, false) : response([])));
  const user = userEvent.setup();
  panel();
  const addBook = screen.getByRole('button', { name: 'Agregar libro' });
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
