import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import AdminPanel from './AdminPanel';

const buyer = { id: 'buyer', nombre: 'Ana Pérez López', email: 'ana@example.invalid', rol: 'cliente', nombreIncompleto: false };
const viewer = (rol) => ({ id: 'viewer', nombre: 'Cuenta de prueba', email: 'viewer@example.invalid', rol });
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
const mount = (content, path = '/') => render(<MemoryRouter initialEntries={[path]}>{content}</MemoryRouter>);
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

test('administrator opens the panel from Mi perfil, confirms the matching account and sees its new role', async () => {
  localStorage.setItem('token', 'signed-session');
  let release;
  const fetchMock = vi.fn(async (url, options) => {
    if (url.endsWith('/auth/me')) return response({ usuario: viewer('administrador') });
    if (url.endsWith('/usuarios/buscar')) {
      expect(JSON.parse(options.body)).toEqual({ email: buyer.email });
      return response({ usuario: buyer });
    }
    if (url.endsWith('/usuarios/buyer/vendedor')) {
      expect(options.headers.Authorization).toBe('Bearer signed-session');
      expect(options.method).toBe('PATCH');
      expect(JSON.parse(options.body)).toEqual({});
      return new Promise((resolve) => { release = resolve; });
    }
    return response(url.endsWith('/cart') ? { items: [], total: 0 } : []);
  });
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();
  mount(<App />);
  await user.click(await screen.findByRole('button', { name: 'Mi cuenta' }));
  await user.click(screen.getByRole('button', { name: 'Panel de administración' }));
  await screen.findByRole('heading', { name: 'Panel de administración' });
  fireEvent.change(screen.getByLabelText(/Correo electrónico/), { target: { value: buyer.email } });
  await user.click(screen.getByRole('button', { name: 'Buscar cuenta' }));
  const result = within(await screen.findByRole('article'));
  expect(result.getByText('Cliente')).toBeTruthy();
  await user.click(result.getByRole('button', { name: 'Habilitar como vendedor' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Confirmar habilitación' }));
  expect(dialog.getByText(buyer.nombre)).toBeTruthy();
  expect(dialog.getByText(new RegExp(buyer.email))).toBeTruthy();
  expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'PATCH')).toHaveLength(0);
  await user.dblClick(dialog.getByRole('button', { name: 'Confirmar habilitación' }));
  expect(dialog.getByRole('status').textContent).toContain('Guardando');
  expect(dialog.getByRole('button', { name: 'Cancelar' }).disabled).toBe(true);
  expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'PATCH')).toHaveLength(1);
  release(response({ usuario: { ...buyer, rol: 'vendedor' } }));
  expect(await screen.findByText('Cuenta habilitada como vendedor')).toBeTruthy();
  expect(result.getByText('Vendedor')).toBeTruthy();
  expect(result.queryByRole('button', { name: 'Habilitar como vendedor' })).toBeNull();
}, 10000);

test.each(['cliente', 'vendedor'])('a %s cannot open the admin route or see its profile link', async (role) => {
  localStorage.setItem('token', 'signed-session');
  const fetchMock = vi.fn(async (url) => response(url.endsWith('/auth/me') ? { usuario: viewer(role) }
    : url.endsWith('/cart') ? { items: [], total: 0 } : []));
  vi.stubGlobal('fetch', fetchMock);
  mount(<App />, '/administracion');
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Mi cuenta' }));
  expect(screen.queryByRole('heading', { name: 'Panel de administración' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Panel de administración' })).toBeNull();
  expect(fetchMock.mock.calls.some(([url]) => url.includes('/usuarios/'))).toBe(false);
});

test('lookup errors, empty results and ineligible accounts are explained; failed confirmation keeps the account', async () => {
  const outcomes = {
    'invalid': response({ mensaje: 'Ingresa un correo electrónico válido.' }, 400),
    'absent@example.invalid': response({ usuario: null }),
    'error@example.invalid': response({ mensaje: 'No se pudo buscar la cuenta.' }, 500),
    'seller@example.invalid': response({ usuario: { ...buyer, rol: 'vendedor' } }),
    'admin@example.invalid': response({ usuario: { ...buyer, rol: 'administrador' } }),
    'legacy@example.invalid': response({ usuario: { ...buyer, nombreIncompleto: true } }),
    [buyer.email]: response({ usuario: buyer }),
  };
  vi.stubGlobal('fetch', vi.fn(async (url, options) => url.endsWith('/buscar')
    ? outcomes[JSON.parse(options.body).email]
    : response({ mensaje: 'La cuenta cambió. Vuelve a buscarla antes de continuar.' }, 409)));
  mount(<AdminPanel />);
  const user = userEvent.setup();
  const field = screen.getByLabelText(/Correo electrónico/);
  for (const [email, message] of [
    ['invalid', /Ingresa un correo/], ['absent@example.invalid', /No se encontró/],
    ['error@example.invalid', /No se pudo buscar/], ['seller@example.invalid', /ya tiene el rol de vendedor/],
    ['admin@example.invalid', /rol de administrador/], ['legacy@example.invalid', /debe completar su nombre y apellidos/],
  ]) {
    fireEvent.change(field, { target: { value: email } });
    await user.click(screen.getByRole('button', { name: 'Buscar cuenta' }));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Habilitar como vendedor' })).toBeNull();
  }
  fireEvent.change(field, { target: { value: buyer.email } });
  await user.click(screen.getByRole('button', { name: 'Buscar cuenta' }));
  await user.click(await screen.findByRole('button', { name: 'Habilitar como vendedor' }));
  const dialog = within(screen.getByRole('dialog'));
  await user.click(dialog.getByRole('button', { name: 'Confirmar habilitación' }));
  expect((await dialog.findByRole('alert')).textContent).toMatch(/La cuenta cambió/);
  await user.click(dialog.getByRole('button', { name: 'Cancelar' }));
  expect(await screen.findByText('Cliente')).toBeTruthy();
}, 10000);
