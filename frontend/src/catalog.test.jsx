import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SellerPanel from './DashboardVendedor';
import Inicio from './Inicio';

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

test('saved edits survive remount, appear in public catalog and deletion refreshes inventory', async () => {
  let books = [{ _id: 'book', titulo: 'Original', autor: 'Autor', precio: 12, stock: 2,
    tipoTapa: 'dura', disponibilidad: true, categoria: { _id: 'cat', nombre: 'Historia' } }];
  const fetchMock = vi.fn(async (url, options) => {
    if (options.method === 'PATCH') {
      expect(options.headers.Authorization).toBe('Bearer test');
      books = [{ ...books[0], ...JSON.parse(options.body) }];
      return { ok: true, json: async () => ({ libro: books[0] }) };
    }
    if (options.method === 'DELETE') { books = []; return { ok: true, status: 204 }; }
    return { ok: true, json: async () => url.endsWith('/categories') ? [{ _id: 'cat', nombre: 'Historia' }] : books };
  });
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('token', 'test');
  const user = userEvent.setup();
  const panel = () => render(<MemoryRouter><SellerPanel user={{ id: 'seller', nombre: 'Ana' }} /></MemoryRouter>);
  let view = panel();
  await user.click(await screen.findByRole('button', { name: 'Editar Original' }));
  const dialog = within(screen.getByRole('dialog'));
  const title = dialog.getByLabelText(/Título del Libro/);
  await user.clear(title); await user.type(title, 'Actualizado');
  await user.click(dialog.getByRole('button', { name: 'Guardar Cambios' }));
  await screen.findByRole('button', { name: 'Editar Actualizado' });
  view.unmount(); view = panel();
  await screen.findByRole('button', { name: 'Editar Actualizado' });
  view.unmount();
  view = render(<MemoryRouter><Inicio /></MemoryRouter>);
  expect((await screen.findAllByText('Actualizado')).length).toBeGreaterThan(0);
  await user.click(screen.getByRole('combobox', { name: 'Precio' }));
  await user.click(screen.getByRole('option', { name: '$25 o más' }));
  expect(screen.queryByText('Actualizado')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Limpiar' }));
  await user.click(screen.getByRole('combobox', { name: 'Encuadernación' }));
  await user.click(screen.getByRole('option', { name: 'Tapa blanda' }));
  expect(screen.queryByText('Actualizado')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Limpiar' }));
  await user.click(screen.getByRole('combobox', { name: 'Categoría' }));
  await user.click(screen.getByRole('option', { name: 'Historia' }));
  expect(screen.getAllByText('Actualizado').length).toBeGreaterThan(0);
  await user.type(screen.getByLabelText('Buscar libro o autor'), 'inexistente');
  expect(screen.queryByText('Actualizado')).toBeNull();
  view.unmount(); view = panel();
  await user.click(await screen.findByRole('button', { name: 'Eliminar Actualizado' }));
  await screen.findByText('No se encontraron libros en el inventario.');
  view.unmount();
  render(<MemoryRouter><Inicio /></MemoryRouter>);
  await screen.findByText('No encontramos libros con esos filtros');
  expect(screen.queryByText('Actualizado')).toBeNull();
});

test('creates a book using canonical API fields and shows the refreshed inventory', async () => {
  let books = [];
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      expect(body).toEqual({ titulo: 'Nuevo', autor: 'Autora', precio: 15,
        categoria: 'cat', stock: 0, tipoTapa: 'blanda', disponibilidad: true, portada_url: '' });
      books = [{ _id: 'new', ...body }];
      return { ok: true, status: 201, json: async () => ({ libro: books[0] }) };
    }
    return { ok: true, json: async () => url.endsWith('/categories') ? [{ _id: 'cat', nombre: 'Historia' }] : books };
  }));
  const user = userEvent.setup();
  render(<MemoryRouter><SellerPanel user={{ id: 'seller', nombre: 'Ana' }} /></MemoryRouter>);
  await screen.findByText('No se encontraron libros en el inventario.');
  await user.click(screen.getByRole('button', { name: 'Agregar Libro' }));
  const dialog = within(screen.getByRole('dialog'));
  await user.click(dialog.getByRole('combobox', { name: /Categoría/ }));
  await user.click(screen.getByRole('option', { name: 'Historia' }));
  await user.type(dialog.getByLabelText(/Título del Libro/), 'Nuevo');
  await user.type(dialog.getByLabelText(/Autor/), 'Autora');
  await user.type(dialog.getByLabelText(/Precio/), '15');
  await user.click(dialog.getByRole('button', { name: 'Agregar' }));
  await screen.findByRole('button', { name: 'Editar Nuevo' });
});

test('API failure shows error and retry without local book fallback', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API no disponible')));
  render(<MemoryRouter><Inicio /></MemoryRouter>);
  await screen.findByText('API no disponible');
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Añadir a compra' })).toBeNull();
});
