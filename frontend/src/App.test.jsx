import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

const seller = { _id: '123', nombre: 'Ana', email: 'ana@example.com', rol: 'vendedor' };
function mockSession(usuario = seller) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ usuario }) });
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
  await user.click(screen.getAllByRole('button', { name: 'Añadir a compra' })[0]);
  await user.click(screen.getByRole('button', { name: 'Mi cuenta' }));
  await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await screen.findByRole('button', { name: 'Iniciar sesión' });
  expect(localStorage.getItem('token')).toBeNull();
  expect(localStorage.getItem('preferencia')).toBe('conservar');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByText('Ir al Panel de Vendedor')).toBeNull();
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
