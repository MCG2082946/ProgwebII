import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SellerPanel from './DashboardVendedor';
import SellerReports from './components/SellerReports';

const emptyReports = { lowStockThreshold: 5, lowStock: [], inventory: [], orders: [], ranking: [] };
const response = (data, ok = true) => ({ ok, json: async () => data });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

test('seller opens reports from the inventory and sees the four API tables', async () => {
  const user = userEvent.setup();
  localStorage.setItem('token', 'seller-test-token');
  const reports = vi.fn(async () => response({
    lowStockThreshold: 5,
    lowStock: [{ id: 'a', title: 'Novela', category: 'Ficción', units: 2 }],
    inventory: [{ id: 'ficcion', category: 'Ficción', titles: 2, units: 8 }],
    orders: [{ status: 'Confirmados', orders: 1, units: 3 }, { status: 'Pendientes', orders: 2, units: 4 }],
    ranking: [{ id: 'a', title: 'Título guardado', units: 3 }],
  }));
  vi.stubGlobal('fetch', (url, options) => url.includes('/reports?') ? reports(url, options) : Promise.resolve(response([])));

  render(<MemoryRouter><SellerPanel user={{ id: 'seller', nombre: 'Librería', rol: 'vendedor' }} /></MemoryRouter>);
  expect(reports).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Reportes' }));
  const lowStock = await screen.findByRole('table', { name: 'Libros con bajo stock' });
  expect(within(lowStock).getByRole('cell', { name: 'Novela' })).toBeTruthy();
  expect(screen.getByText('Umbral aplicado: 5 unidades o menos por título.')).toBeTruthy();
  const inventory = screen.getByRole('table', { name: 'Inventario por categoría' });
  expect(within(inventory).getByRole('columnheader', { name: 'Ejemplares' })).toBeTruthy();
  expect(within(inventory).getByRole('cell', { name: '8' })).toBeTruthy();
  const orders = screen.getByRole('table', { name: 'Pedidos por periodo' });
  expect(within(orders).getByRole('cell', { name: 'Pendientes' })).toBeTruthy();
  const ranking = screen.getByRole('table', { name: 'Libros más comprados' });
  expect(within(ranking).getByRole('cell', { name: 'Título guardado' })).toBeTruthy();
  expect(reports.mock.calls[0][1].headers.Authorization).toBe('Bearer seller-test-token');

  fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText(/^Hasta/), { target: { value: '2026-01-31' } });
  await user.click(screen.getByRole('button', { name: 'Aplicar periodo' }));
  expect(await screen.findByText(/Del 2026-01-01 al 2026-01-31/)).toBeTruthy();
  expect(new URL(reports.mock.calls.at(-1)[0]).search).toBe('?desde=2026-01-01&hasta=2026-01-31');
  await user.click(screen.getByRole('button', { name: 'Volver al inventario' }));
  expect(screen.getByRole('heading', { name: 'Mi inventario' })).toBeTruthy();
});

test('reports show loading, errors and empty states after retry', async () => {
  let fail;
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { fail = resolve; }))
    .mockResolvedValueOnce(response(emptyReports));
  vi.stubGlobal('fetch', fetchMock);
  render(<SellerReports />);
  expect(screen.getByRole('status').textContent).toContain('Cargando reportes');
  fail(response({ mensaje: 'No se pudieron consultar los reportes.' }, false));
  expect(await screen.findByRole('alert')).toBeTruthy();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
  for (const message of [
    'No hay libros con bajo stock.', 'No hay libros en tu inventario.',
    'No hay pedidos de tus libros en este periodo.', 'No hay compras confirmadas de tus libros en este periodo.',
  ]) expect(await screen.findByText(message)).toBeTruthy();
  expect(screen.queryByRole('table')).toBeNull();
});
