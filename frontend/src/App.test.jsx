import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import App from './App';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function NavigationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <output aria-label="Ruta actual">{location.pathname}</output>
    <button onClick={() => navigate('/vendedor')}>Probar ruta protegida</button>
    <button onClick={() => navigate(-1)}>Atrás</button>
  </>;
}

function mount(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><App /><NavigationProbe /></MemoryRouter>);
}

const structured = { nombres: 'Ana', primerApellido: 'Perez', segundoApellido: 'Lopez', sinSegundoApellido: false };
const seller = { ...structured, _id: '123', nombre: 'Ana', email: 'ana@example.com', rol: 'vendedor' };
function mockSession(usuario = seller) {
  const fetchMock = vi.fn(async (url) => ({ ok: true, status: 200, json: async () => url.endsWith('/auth/me') ? { usuario } : url.includes('/cart') ? { items: [], total: 0 } : url.endsWith('/categories') ? [{ _id: 'cat', nombre: 'Novela' }] : [{ _id: 'book', titulo: 'Libro API', autor: 'Autor', precio: 10, tipoTapa: 'blanda', categoria: 'cat', stock: 4, disponibilidad: true }] }));
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('token', 'jwt-test');
  return fetchMock;
}

test('un visitante no ve cerrar sesión y no puede abrir el panel protegido', async () => {
  mount('/vendedor');
  await screen.findByRole('button', { name: 'Iniciar sesión' });
  expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
  expect(screen.getByLabelText('Ruta actual').textContent).toBe('/');
});

test('restaura la sesión y cierra desde el perfil sin recargar, limpiando el carrito', async () => {
  const fetchMock = mockSession();
  localStorage.setItem('preferencia', 'conservar');
  const user = userEvent.setup();
  mount();
  await screen.findByRole('button', { name: 'Mi cuenta' });
  await user.click((await screen.findAllByRole('button', { name: 'Añadir al carrito' }))[0]);
  await user.click(screen.getByRole('button', { name: 'Mi cuenta' }));
  await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await screen.findByRole('button', { name: 'Iniciar sesión' });
  expect(localStorage.getItem('token')).toBeNull();
  expect(localStorage.getItem('preferencia')).toBe('conservar');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByText('Ir al panel del vendedor')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Carrito' }));
  expect(screen.getByText('Tu carrito está vacío.')).toBeTruthy();
  await user.keyboard('{Escape}');
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/me'), expect.objectContaining({
    headers: { Authorization: 'Bearer jwt-test' },
  }));
  await user.click(await screen.findByRole('button', { name: 'Probar ruta protegida' }));
  await waitFor(() => expect(screen.getByLabelText('Ruta actual').textContent).toBe('/'));
});

test('cerrar desde el panel redirige a inicio y bloquea regresar con Atrás o recargar', async () => {
  mockSession();
  const user = userEvent.setup();
  const view = mount('/vendedor');
  await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
  await screen.findByRole('button', { name: 'Iniciar sesión' });
  expect(screen.getByLabelText('Ruta actual').textContent).toBe('/');
  await user.click(screen.getByRole('button', { name: 'Atrás' }));
  expect(screen.queryByText('Panel de Vendedor')).toBeNull();
  view.unmount();
  mount('/vendedor');
  await screen.findByRole('button', { name: 'Iniciar sesión' });
  expect(screen.getByLabelText('Ruta actual').textContent).toBe('/');
});

test('permite iniciar sesión nuevamente después de salir y conserva el JWT para recargar', async () => {
  const fetchMock = mockSession();
  const user = userEvent.setup();
  mount('/vendedor');
  await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ usuario: seller, token: 'nuevo-jwt' }) });
  await user.click(await screen.findByRole('button', { name: 'Iniciar sesión' }));
  await user.type(screen.getByLabelText(/Correo Electrónico/), seller.email);
  await user.type(screen.getByLabelText(/Contraseña/), 'Password123');
  await user.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
  await screen.findByRole('button', { name: 'Mi cuenta' });
  expect(localStorage.getItem('token')).toBe('nuevo-jwt');
});

for (const path of ['/', '/vendedor']) {
  test(`guarda el perfil desde ${path}, lo comparte entre tienda y panel y lo recupera al montar`, async () => {
    let stored = { ...seller };
    const fetchMock = vi.fn(async (url, options = {}) => {
      let data;
      if (url.endsWith('/auth/me')) {
        if (options.method === 'PATCH') {
          expect(options.headers.Authorization).toBe('Bearer jwt-test');
          expect(JSON.parse(options.body)).toEqual({ ...structured, nombres: 'Ana Editada', email: 'nueva@example.com' });
          stored = { ...stored, ...JSON.parse(options.body), nombre: 'Ana Editada Perez Lopez' };
        }
        data = { usuario: stored };
      } else data = [];
      return { ok: true, status: 200, json: async () => data };
    });
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('token', 'jwt-test');
    const user = userEvent.setup();
    const view = mount(path);
    await user.click(await screen.findByRole('button', { name: path === '/' ? 'Mi cuenta' : 'Mi perfil' }));
    await user.click(screen.getByRole('button', { name: 'Editar Perfil' }));
    await user.clear(screen.getByLabelText(/Nombre\(s\)/));
    await user.type(screen.getByLabelText(/Nombre\(s\)/), 'Ana Editada');
    await user.clear(screen.getByLabelText('Correo electrónico'));
    await user.type(screen.getByLabelText('Correo electrónico'), 'nueva@example.com');
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await screen.findByText('Perfil guardado.');
    expect(screen.queryByLabelText(/Contraseña/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cerrar perfil' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    if (path === '/') {
      expect(screen.queryByText('Sesión iniciada como Vendedor')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Ir al panel del vendedor' })).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Mi cuenta' }));
      await user.click(screen.getByRole('button', { name: 'Ir al panel del vendedor' }));
      await screen.findByText('Ana Editada Perez Lopez');
    } else {
      await screen.findByText('Ana Editada Perez Lopez');
      await user.click(screen.getByRole('button', { name: 'Volver a la Tienda' }));
      await user.click(await screen.findByRole('button', { name: 'Mi cuenta' }));
      await user.click(screen.getByRole('button', { name: 'Editar Perfil' }));
      expect(screen.getByLabelText(/Nombre\(s\)/).value).toBe('Ana Editada');
    }
    view.unmount(); mount('/vendedor');
    await user.click(await screen.findByRole('button', { name: 'Mi perfil' }));
    await user.click(screen.getByRole('button', { name: 'Editar Perfil' }));
    expect(screen.getByLabelText(/Nombre\(s\)/).value).toBe('Ana Editada');
    expect(screen.getByLabelText('Correo electrónico').value).toBe('nueva@example.com');
  });
}

test('valida perfil y conserva formulario ante error de API, con reintento sin duplicados', async () => {
  const fetchMock = mockSession();
  const original = fetchMock.getMockImplementation();
  let finish;
  fetchMock.mockImplementation((url, options) => options?.method === 'PATCH'
    ? new Promise((resolve) => { finish = resolve; }) : original(url, options));
  const user = userEvent.setup();
  mount();
  await user.click(await screen.findByRole('button', { name: 'Mi cuenta' }));
  await user.click(screen.getByRole('button', { name: 'Editar Perfil' }));
  await user.clear(screen.getByLabelText(/Nombre\(s\)/));
  await user.type(screen.getByLabelText(/Nombre\(s\)/), ' ');
  await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
  expect(screen.getByLabelText(/Nombre\(s\)/).getAttribute('aria-invalid')).toBe('true');
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(0);
  await user.type(screen.getByLabelText(/Nombre\(s\)/), 'Nuevo');
  await user.clear(screen.getByLabelText('Correo electrónico'));
  await user.type(screen.getByLabelText('Correo electrónico'), 'incorrecto');
  await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(0);
  await user.clear(screen.getByLabelText('Correo electrónico'));
  await user.type(screen.getByLabelText('Correo electrónico'), 'nuevo@example.com');
  await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
  const saving = screen.getByRole('button', { name: 'Guardando...' });
  expect(saving.disabled).toBe(true);
  fireEvent.click(saving);
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1);
  finish({ ok: false, status: 409, json: async () => ({ mensaje: 'El registro ya existe.' }) });
  await screen.findAllByText('El registro ya existe.');
  expect(screen.getByLabelText(/Nombre\(s\)/).value).toBe(' Nuevo');
  expect(screen.getByLabelText('Correo electrónico').value).toBe('nuevo@example.com');
  await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
  finish({ ok: true, status: 200, json: async () => ({ usuario: { ...seller, nombres: 'Nuevo', nombre: 'Nuevo Perez Lopez', email: 'nuevo@example.com' } }) });
  await screen.findByText('Perfil guardado.');
});

for (const [path, role, visible] of [['/', 'vendedor', true], ['/', 'cliente', false], ['/vendedor', 'vendedor', false]]) {
  test(`acceso del modal al panel en ${path} para ${role}: ${visible}`, async () => {
    mockSession({ ...seller, rol: role });
    const user = userEvent.setup();
    mount(path);
    await user.click(await screen.findByRole('button', { name: path === '/' ? 'Mi cuenta' : 'Mi perfil' }));
    const link = within(screen.getByRole('dialog')).queryByRole('button', { name: 'Ir al panel del vendedor' });
    if (visible) {
      expect(link).toBeTruthy();
      await user.click(link);
      await screen.findByText('Panel de Vendedor');
      expect(screen.getByRole('heading', { name: 'Mi inventario' })).toBeTruthy();
      const profileControl = screen.getByRole('button', { name: 'Mi perfil' });
      expect(within(profileControl).getByText(seller.nombre)).toBeTruthy();
      expect(within(profileControl).queryByText('Cerrar sesión')).toBeNull();
      expect(screen.getByRole('button', { name: 'Agregar libro' })).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Volver a la Tienda' }));
      await screen.findByRole('button', { name: 'Mi cuenta' });
      expect(screen.queryByRole('dialog')).toBeNull();
    } else expect(link).toBeNull();
  });
}
