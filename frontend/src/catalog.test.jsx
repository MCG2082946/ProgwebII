import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SellerPanel from './DashboardVendedor';
import Inicio from './Inicio';

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

test('saved edits survive remount, appear in public catalog and deletion refreshes inventory', async () => {
  const cover = 'https://images.example.invalid/Books/MiPortada.JPG?Firma=aBc';
  let books = [{ _id: 'book', titulo: 'Original', autor: 'Autor', precio: 12, stock: 2,
    tipoTapa: 'dura', disponibilidad: true, categoria: { _id: 'cat', nombre: 'Historia' } }];
  const categories = [{ _id: 'cat', nombre: 'Historia' }, { _id: 'travel', nombre: 'Viajes' }];
  const fetchMock = vi.fn(async (url, options) => {
    if (options.method === 'PATCH') {
      expect(options.headers.Authorization).toBe('Bearer test');
      const payload = JSON.parse(options.body);
      expect(payload.categoria).toEqual(['cat', 'travel']);
      expect(payload.portada_url).toBe(cover);
      books = [{ ...books[0], ...payload, titulo: payload.titulo.toUpperCase(), autor: payload.autor.toUpperCase(),
        categoria: payload.categoria.map((id) => categories.find((item) => item._id === id)) }];
      return { ok: true, json: async () => ({ libro: books[0] }) };
    }
    if (options.method === 'DELETE') { books = []; return { ok: true, status: 204 }; }
    return { ok: true, json: async () => url.endsWith('/categories') ? categories : books };
  });
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('token', 'test');
  const user = userEvent.setup();
  const panel = () => render(<MemoryRouter><SellerPanel user={{ id: 'seller', nombre: 'Ana' }} /></MemoryRouter>);
  let view = panel();
  await user.click(await screen.findByRole('button', { name: 'Editar Original' }));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('Historia')).toBeTruthy();
  await user.click(dialog.getByRole('combobox', { name: 'Categorías' }));
  await user.click(screen.getByRole('option', { name: 'Viajes' }));
  const title = dialog.getByLabelText(/Título del Libro/);
  await user.clear(title); await user.type(title, 'actualizado');
  const author = dialog.getByLabelText(/Autor/);
  await user.clear(author); await user.type(author, 'autora');
  fireEvent.change(dialog.getByLabelText(/URL de la Portada/), { target: { value: cover } });
  fireEvent.load(dialog.getByRole('img', { name: 'Vista previa de la portada' }));
  await user.click(dialog.getByRole('button', { name: 'Guardar Cambios' }));
  await screen.findByRole('button', { name: 'Editar ACTUALIZADO' });
  view.unmount(); view = panel();
  await screen.findByRole('button', { name: 'Editar ACTUALIZADO' });
  view.unmount();
  view = render(<MemoryRouter><Inicio /></MemoryRouter>);
  expect((await screen.findAllByRole('img', { name: 'ACTUALIZADO' }))[0].getAttribute('src')).toBe(cover);
  await user.click(screen.getByRole('combobox', { name: 'Precio (MXN)' }));
  await user.click(screen.getByRole('option', { name: '$400 o más' }));
  expect(screen.queryByText('ACTUALIZADO')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Limpiar' }));
  await user.click(screen.getByRole('combobox', { name: 'Encuadernación' }));
  await user.click(screen.getByRole('option', { name: 'Tapa blanda' }));
  expect(screen.queryByText('ACTUALIZADO')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Limpiar' }));
  for (const category of ['Historia', 'Viajes']) {
    await user.click(screen.getByRole('combobox', { name: 'Categoría' }));
    await user.click(screen.getByRole('option', { name: category }));
    expect(screen.getAllByText('ACTUALIZADO')).toHaveLength(1);
  }
  await user.click(screen.getByText('ACTUALIZADO'));
  expect(within(screen.getByRole('dialog')).getByText('Historia, Viajes')).toBeTruthy();
  expect(within(screen.getByRole('dialog')).getByRole('img', { name: 'ACTUALIZADO' }).getAttribute('src')).toBe(cover);
  expect(within(screen.getByRole('dialog')).getByText('AUTORA')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
  await user.type(screen.getByLabelText('Buscar libro o autor'), 'inexistente');
  expect(screen.queryByText('ACTUALIZADO')).toBeNull();
  view.unmount(); view = panel();
  await user.click(await screen.findByRole('button', { name: 'Eliminar ACTUALIZADO' }));
  await screen.findByText('No se encontraron libros en el inventario.');
  view.unmount();
  render(<MemoryRouter><Inicio /></MemoryRouter>);
  await screen.findByText('No encontramos libros con esos filtros');
  expect(screen.queryByText('ACTUALIZADO')).toBeNull();
}, 10000);

test('creates a book using canonical API fields and shows the refreshed inventory', async () => {
  const cover = 'https://images.example.invalid/Books/Foto.png?token=aBc';
  let books = [];
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      expect(body).toEqual({ titulo: 'nuevo', autor: 'autora', precio: 15,
        categoria: ['cat', 'travel'], stock: 0, tipoTapa: 'blanda', disponibilidad: true, portada_url: cover });
      books = [{ _id: 'new', ...body, titulo: 'NUEVO', autor: 'AUTORA' }];
      return { ok: true, status: 201, json: async () => ({ libro: books[0] }) };
    }
    return { ok: true, json: async () => url.endsWith('/categories') ? [{ _id: 'cat', nombre: 'Historia' }, { _id: 'travel', nombre: 'Viajes' }] : books };
  }));
  const user = userEvent.setup();
  render(<MemoryRouter><SellerPanel user={{ id: 'seller', nombre: 'Ana' }} /></MemoryRouter>);
  await screen.findByText('No se encontraron libros en el inventario.');
  await user.click(screen.getByRole('button', { name: 'Agregar libro' }));
  const dialog = within(screen.getByRole('dialog'));
  await user.click(dialog.getByRole('combobox', { name: /Categoría/ }));
  await user.click(screen.getByRole('option', { name: 'Historia' }));
  await user.click(dialog.getByRole('combobox', { name: 'Categorías' }));
  await user.click(screen.getByRole('option', { name: 'Viajes' }));
  await user.type(dialog.getByLabelText(/Título del Libro/), 'nuevo');
  await user.type(dialog.getByLabelText(/Autor/), 'autora');
  await user.type(dialog.getByLabelText(/Precio/), '15');
  fireEvent.change(dialog.getByLabelText(/URL de la Portada/), { target: { value: cover } });
  fireEvent.load(dialog.getByRole('img', { name: 'Vista previa de la portada' }));
  await user.click(dialog.getByRole('button', { name: 'Agregar' }));
  await screen.findByRole('button', { name: 'Editar NUEVO' });
  expect(screen.getByRole('img', { name: 'NUEVO' }).getAttribute('src')).toBe(cover);
});

test('broken previews and field validation errors preserve the draft', async () => {
  const save = vi.fn(async () => ({ ok: false, status: 400, json: async () => ({
    mensaje: 'Revisa los datos del libro.', campos: { portada_url: 'URL de portada inválida.', autor: 'Indica un autor válido.' },
  }) }));
  vi.stubGlobal('fetch', vi.fn(async (url, options) => options.method === 'POST' ? save() : ({
    ok: true, json: async () => url.endsWith('/categories') ? [{ _id: 'cat', nombre: 'Historia' }] : [],
  })));
  const user = userEvent.setup();
  render(<MemoryRouter><SellerPanel user={{ id: 'seller', nombre: 'Ana', rol: 'vendedor' }} /></MemoryRouter>);
  await screen.findByText('No se encontraron libros en el inventario.');
  await user.click(screen.getByRole('button', { name: 'Agregar libro' }));
  const dialog = within(screen.getByRole('dialog'));
  const title = dialog.getByLabelText(/Título del Libro/);
  const cover = dialog.getByLabelText(/URL de la Portada/);
  await user.type(title, 'mi borrador');
  await user.type(cover, 'https://example.invalid/Producto');
  fireEvent.error(dialog.getByRole('img', { name: 'Vista previa de la portada' }));
  expect(cover.getAttribute('aria-invalid')).toBe('true');
  expect(dialog.getByText('No se pudo cargar la portada. Revisa el enlace de la imagen')).toBeTruthy();
  await user.click(dialog.getByRole('button', { name: 'Agregar' }));
  expect(save).not.toHaveBeenCalled();
  await user.clear(cover);
  await user.type(cover, 'sin-url');
  await user.click(dialog.getByRole('button', { name: 'Agregar' }));
  expect(await dialog.findByText('URL de portada inválida.')).toBeTruthy();
  expect(dialog.getByLabelText(/Autor/).getAttribute('aria-invalid')).toBe('true');
  expect(title.value).toBe('mi borrador');
  expect(cover.value).toBe('sin-url');
});

test('API failure shows error and retry without local book fallback', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API no disponible')));
  render(<MemoryRouter><Inicio /></MemoryRouter>);
  await screen.findByText('API no disponible');
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Añadir al carrito' })).toBeNull();
});

test('filters catalog prices in MXN without gaps at the range boundaries', async () => {
  const titles = ['Antes de 200', 'Exactamente 200', 'Antes de 400', 'Exactamente 400'];
  const books = [199.99, 200, 399.99, 400].map((precio, index) => ({
    _id: String(index), titulo: titles[index], autor: 'Autora', precio,
    stock: 2, tipoTapa: 'dura', disponibilidad: true,
  }));
  vi.stubGlobal('fetch', vi.fn(async (url) => ({
    ok: true, json: async () => url.endsWith('/categories') ? [] : books,
  })));

  const user = userEvent.setup();
  render(<MemoryRouter><Inicio /></MemoryRouter>);
  await screen.findAllByText(titles[0]);

  for (const [label, visible] of [
    ['Menos de $200', [0]],
    ['$200 a $399.99', [1, 2]],
    ['$400 o más', [3]],
  ]) {
    await user.click(screen.getByRole('combobox', { name: 'Precio (MXN)' }));
    await user.click(screen.getByRole('option', { name: label }));
    titles.forEach((title, index) => {
      expect(screen.queryAllByText(title).length > 0).toBe(visible.includes(index));
    });
  }

  await user.click(screen.getByRole('button', { name: 'Limpiar' }));
  titles.forEach((title) => expect(screen.queryAllByText(title).length).toBeGreaterThan(0));
});
