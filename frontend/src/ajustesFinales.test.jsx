import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import Inicio from './Inicio';
import LoginModal from './components/LoginModal';
import { storePages } from './components/StoreInformation';

const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const book = { _id: 'book', titulo: 'Título guardado', autor: 'Autor registrado', precio: 70,
  stock: 3, disponibilidad: true, portada_url: 'https://example.invalid/un-libro.jpg',
  tipoTapa: 'dura', isbn: '9780000000002', descripcion: 'Descripción guardada.',
  categoria: { _id: 'cat', nombre: 'Viajes' } };
const catalog = (url) => url.endsWith('/books') ? [book] : [];
const mount = (path = '/') => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

test('header has one search and all six footer pages open by link and direct route', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url) => response(catalog(url))));
  const user = userEvent.setup();
  let page = mount();
  expect(screen.getAllByRole('textbox')).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Navegante de Páginas' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Carrito' })).toBeTruthy();
  for (const [slug, { title }] of Object.entries(storePages)) {
    const footer = screen.getByRole('navigation', { name: 'Información de la tienda' });
    const link = within(footer).getByRole('link', { name: title });
    expect(link.getAttribute('href')).toBe('/informacion/' + slug);
    await user.click(link);
    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    page.unmount();
    page = mount('/informacion/' + slug);
    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    await user.click(screen.getByRole('link', { name: 'Volver a la tienda' }));
    expect(screen.getByLabelText('Buscar libro o autor')).toBeTruthy();
  }
});

test('broken cover falls back in place and the detail uses the selected record', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url) => response(catalog(url))));
  const user = userEvent.setup();
  mount();
  const cover = (await screen.findAllByRole('img', { name: book.titulo }))[0];
  expect(cover.getAttribute('src')).toBe(book.portada_url);
  const slot = cover.parentElement;
  fireEvent.error(cover);
  expect(within(slot).getByText('Sin portada')).toBeTruthy();
  expect(within(slot).queryByRole('img')).toBeNull();
  await user.click(screen.getAllByText(book.titulo)[0]);
  const dialog = within(screen.getByRole('dialog', { name: 'Ficha del libro' }));
  expect(dialog.getByText(book.autor)).toBeTruthy();
  expect(dialog.getByText(book.categoria.nombre)).toBeTruthy();
  expect(dialog.getByText('Tapa dura')).toBeTruthy();
  expect(dialog.getByText(book.isbn)).toBeTruthy();
  expect(dialog.getByText(book.descripcion)).toBeTruthy();
  expect(dialog.getByRole('img', { name: book.titulo }).getAttribute('src')).toBe(book.portada_url);
});

test.each([
  [{ stock: 0, disponibilidad: true }, 'Agotado'],
  [{ stock: 3, disponibilidad: false }, 'No disponible'],
])(
  'catalog and detail block an unavailable book (%o)', async (override, label) => {
    const fetchMock = vi.fn(async (url) => response(url.endsWith('/books') ? [{ ...book, ...override, portada_url: '' }] : []));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    mount();
    const button = (await screen.findAllByRole('button', { name: label }))[0];
    expect(button.disabled).toBe(true);
    expect(screen.getAllByText('Sin portada').length).toBeGreaterThan(0);
    await user.click(screen.getAllByText(book.titulo)[0]);
    const detail = within(screen.getByRole('dialog'));
    expect(detail.getByText(label)).toBeTruthy();
    expect(detail.getByRole('button', { name: 'Añadir al carrito' }).disabled).toBe(true);
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  },
);

test('a seller sees their own publication in the catalog and detail, and can add another seller’s book', async () => {
  const own = { ...book, titulo: 'Publicación propia', id_vendedor: 'seller' };
  const other = { ...book, _id: 'other', titulo: 'Publicación ajena', id_vendedor: 'other-seller' };
  const fetchMock = vi.fn(async (url) => response(
    url.endsWith('/books') ? [own, other] : url.includes('/cart') ? { items: [], total: 0 } : [],
  ));
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();
  render(<MemoryRouter><Inicio user={{ _id: 'seller', nombre: book.autor, rol: 'vendedor' }} /></MemoryRouter>);
  expect((await screen.findAllByRole('button', { name: 'Es tu publicación' }))[0].disabled).toBe(true);
  await user.click(screen.getAllByText(own.titulo)[0]);
  const detail = within(screen.getByRole('dialog', { name: 'Ficha del libro' }));
  expect(detail.getByRole('button', { name: 'Es tu publicación' }).disabled).toBe(true);
  expect(detail.queryByRole('button', { name: 'Añadir al carrito' })).toBeNull();
  await user.click(detail.getByRole('button', { name: 'Cerrar detalle' }));
  const [add] = await screen.findAllByRole('button', { name: 'Añadir al carrito' });
  await user.click(add);
  await waitFor(() => {
    const mutations = fetchMock.mock.calls.filter(([, options]) => options.method === 'POST');
    expect(mutations).toHaveLength(1);
    expect(JSON.parse(mutations[0][1].body)).toEqual({ id_libro: other._id, cantidad: 1 });
  });
});

test('login and registration end at the email form action with no external provider', async () => {
  const account = { id: 'local-user', rol: 'vendedor' };
  const login = vi.fn();
  const fetchMock = vi.fn(async () => response({ usuario: account, token: 'local-jwt' }));
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();
  render(<LoginModal open onClose={() => {}} onLoginSuccess={login} />);
  for (const [tab, submit] of [['Registrarse', 'Registrarme'], ['Iniciar Sesión', 'Iniciar Sesión']]) {
    await user.click(screen.getByRole('tab', { name: tab }));
    const dialog = within(screen.getByRole('dialog'));
    const actions = dialog.getAllByRole('button');
    expect(actions.at(-1)).toBe(dialog.getByRole('button', { name: submit }));
    expect(dialog.queryByText(/Google|Facebook|O continúa con|sin configurar/i)).toBeNull();
    if (tab === 'Registrarse') {
      for (const label of [/Nombre\(s\)/, /Primer apellido/, /Segundo apellido/]) {
        expect(dialog.getByRole('textbox', { name: label }).required).toBe(true);
      }
    }
  }
  expect(fetchMock).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText(/Correo Electrónico/), 'test@example.invalid');
  await user.type(screen.getByLabelText(/Contraseña/), 'password-test');
  await user.click(screen.getByRole('button', { name: 'Iniciar Sesión', exact: true }));
  await waitFor(() => expect(login).toHaveBeenCalledWith(account));
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls[0][0]).toMatch(/\/auth\/login$/);
  expect(localStorage.getItem('token')).toBe('local-jwt');
});
