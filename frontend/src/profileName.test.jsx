import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginModal from './components/LoginModal';
import UserProfileModal from './components/UserProfileModal';
import { validateName } from './profileName';

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
const cases = [
  { nombres: 'Ana', primerApellido: 'Pérez', segundoApellido: 'López', sinSegundoApellido: false },
  { nombres: ' María   José ', primerApellido: 'De la Cruz', segundoApellido: 'Muñoz', sinSegundoApellido: false },
  { nombres: 'Jean-Luc', primerApellido: "O'Neill", segundoApellido: '', sinSegundoApellido: true },
  { nombres: 'Zoë', primerApellido: 'D’Angelo', segundoApellido: 'García-Márquez', sinSegundoApellido: false },
];
async function fill(user, data) {
  for (const [field, label] of [['nombres', /Nombre\(s\)/], ['primerApellido', /Primer apellido/], ['segundoApellido', /Segundo apellido/]]) {
    if (data[field]) await user.type(screen.getByRole('textbox', { name: label }), data[field]);
  }
  if (data.sinSegundoApellido) await user.click(screen.getByRole('checkbox'));
}
for (const mode of ['registro', 'perfil']) {
  for (const [index, data] of cases.entries()) {
    test(`${mode}: envía datos estructurados normalizados ${index}`, async () => {
      const success = vi.fn();
      const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({
        token: 'test-token', usuario: { ...validateName(data).data, nombre: 'Nombre devuelto', rol: 'cliente' }
      }) }));
      vi.stubGlobal('fetch', fetchMock);
      const user = userEvent.setup();
      if (mode === 'registro') {
        render(<LoginModal open onClose={() => {}} onLoginSuccess={success} />);
        await user.click(screen.getByRole('tab', { name: 'Registrarse' }));
        await user.type(screen.getByLabelText(/Correo Electrónico/), 'test@example.com');
        await user.type(screen.getByLabelText(/Contraseña/), 'password123');
      } else {
        render(<UserProfileModal open user={{ nombre: 'Nombre antiguo', email: 'test@example.com' }} onUpdateUser={success} onClose={() => {}} />);
        expect(screen.getByText(/Falta completar tu nombre/)).toBeTruthy();
        await user.click(screen.getByRole('button', { name: /Editar Perfil|Completar perfil/ }));
        expect(screen.getByRole('textbox', { name: /Nombre\(s\)/ }).value).toBe('');
      }
      await fill(user, data);
      await user.click(screen.getByRole('button', { name: mode === 'registro' ? 'Registrarme' : 'Guardar Cambios' }));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(payload).toEqual({ ...validateName(data).data, email: 'test@example.com', ...(mode === 'registro' ? { password: 'password123' } : {}) });
      expect(payload.nombre).toBeUndefined();
      expect(success).toHaveBeenCalled();
    });
  }

  test(`${mode}: muestra errores por campo sin borrar texto ni enviar contradicciones`, async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    if (mode === 'registro') {
      render(<LoginModal open onClose={() => {}} onLoginSuccess={() => {}} />);
      await user.click(screen.getByRole('tab', { name: 'Registrarse' }));
      await user.type(screen.getByLabelText(/Correo Electrónico/), 'test@example.com');
      await user.type(screen.getByLabelText(/Contraseña/), 'password123');
    } else {
      render(<UserProfileModal open user={{ nombre: 'Nombre previo', email: 'test@example.com' }} onClose={() => {}} />);
      await user.click(screen.getByRole('button', { name: /Editar Perfil|Completar perfil/ }));
    }
    const save = () => user.click(screen.getByRole('button', { name: mode === 'registro' ? 'Registrarme' : 'Guardar Cambios' }));
    await user.type(screen.getByRole('textbox', { name: /Nombre\(s\)/ }), 'Ana123');
    await save();
    for (const label of [/Nombre\(s\)/, /Primer apellido/, /Segundo apellido/]) {
      expect(screen.getByRole('textbox', { name: label }).getAttribute('aria-invalid')).toBe('true');
    }
    expect(screen.getByRole('textbox', { name: /Nombre\(s\)/ }).value).toBe('Ana123');
    await user.clear(screen.getByRole('textbox', { name: /Nombre\(s\)/ }));
    await user.type(screen.getByRole('textbox', { name: /Nombre\(s\)/ }), 'Ana');
    await fill(user, { primerApellido: 'Pérez', segundoApellido: 'López' });
    await user.click(screen.getByRole('checkbox'));
    await save();
    expect(screen.getByText(/No puedes indicar un segundo apellido/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('textbox', { name: /Segundo apellido/ }).value).toBe('López');
  });
}

test('validación local rechaza límites, símbolos y estados contradictorios', () => {
  for (const change of [{ nombres: 'x'.repeat(81) }, { nombres: 'Ana!' }, { primerApellido: ' ' },
    { segundoApellido: '', sinSegundoApellido: undefined }, { sinSegundoApellido: true }]) {
    expect(validateName({ ...cases[0], ...change }).valid).toBe(false);
  }
});

test('lectura con etiquetas, sin controles; cancelar descarta el borrador sin llamar la API', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  const update = vi.fn();
  const user = userEvent.setup();
  render(<UserProfileModal open user={{ ...cases[0], nombre: 'Ana P\u00e9rez L\u00f3pez', email: 'ana@example.com' }} onClose={() => {}} onUpdateUser={update} />);
  expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.getByText('Nombre(s)').tagName).toBe('DT');
  expect(screen.getByText('Primer apellido').tagName).toBe('DT');
  expect(screen.getByText('Segundo apellido').tagName).toBe('DT');
  expect(screen.getAllByText('Correo electr\u00f3nico')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: /Editar Perfil|Completar perfil/ }));
  expect(screen.getAllByLabelText('Correo electr\u00f3nico')).toHaveLength(1);
  expect(screen.getAllByText('Correo electr\u00f3nico').filter((element) => element.tagName === 'LABEL')).toHaveLength(1);
  await user.clear(screen.getByLabelText(/Nombre\(s\)/));
  await user.type(screen.getByLabelText(/Nombre\(s\)/), 'Borrador123');
  await user.clear(screen.getByLabelText('Correo electr\u00f3nico'));
  await user.type(screen.getByLabelText('Correo electr\u00f3nico'), 'otro@example.com');
  await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
  expect(screen.getByLabelText(/Nombre\(s\)/).getAttribute('aria-invalid')).toBe('true');
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  expect(screen.queryByText('otro@example.com')).toBeNull();
  expect(screen.getAllByText('ana@example.com').length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: /Editar Perfil|Completar perfil/ }));
  expect(screen.getByLabelText(/Nombre\(s\)/).value).toBe('Ana');
  expect(screen.getByLabelText('Correo electr\u00f3nico').value).toBe('ana@example.com');
  expect(screen.getByLabelText(/Nombre\(s\)/).getAttribute('aria-invalid')).toBe('false');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});

test('lectura omite segundo apellido y una cuenta anterior mantiene nombre y aviso al cancelar', async () => {
  const user = userEvent.setup();
  const view = render(<UserProfileModal open user={{ ...cases[2], nombre: "Jean-Luc O'Neill", email: 'one@example.com' }} onClose={() => {}} />);
  expect(screen.queryByText('Segundo apellido')).toBeNull();
  expect(screen.queryByText('No tengo segundo apellido')).toBeNull();
  await user.click(screen.getByRole('button', { name: /Editar Perfil|Completar perfil/ }));
  expect(screen.getByRole('checkbox').checked).toBe(true);
  view.rerender(<UserProfileModal open user={{ nombre: 'Nombre antiguo intacto', email: 'old@example.com' }} onClose={() => {}} />);
  expect(screen.getByText('Nombre antiguo intacto')).toBeTruthy();
  expect(screen.getByText(/Falta completar tu nombre/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Editar Perfil' })).toBeNull();
  expect(screen.getAllByRole('button', { name: 'Completar perfil' })).toHaveLength(1);
  expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: /Editar Perfil|Completar perfil/ }));
  await user.type(screen.getByLabelText(/Nombre\(s\)/), 'Ana');
  expect(screen.queryByRole('button', { name: 'Completar perfil' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.getByText('Nombre antiguo intacto')).toBeTruthy();
  expect(screen.getByText(/Falta completar tu nombre/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Completar perfil' })).toBeTruthy();
});

for (const rol of ['vendedor', 'cliente']) {
  test(`Mi perfil identifica la sesión ${rol} y conserva Deseados y Comprados`, async () => {
    const user = userEvent.setup();
    render(<UserProfileModal open user={{ ...cases[0], rol, nombre: 'Ana Pérez López', email: 'ana@example.com' }}
      onClose={() => {}} wishlist={[{ id: 'wish', title: 'Libro deseado', author: 'Autor' }]}
      purchasedBooks={[{ id: 'bought', title: 'Libro comprado', author: 'Autor' }]} />);
    expect(screen.getByRole('dialog', { name: 'Mi perfil' })).toBeTruthy();
    expect(Boolean(screen.queryByText('Vendedor'))).toBe(rol === 'vendedor');
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Editar Perfil' })).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Deseados y Comprados' }));
    expect(screen.getByText('Libro deseado')).toBeTruthy();
    expect(screen.getByText('Libro comprado')).toBeTruthy();
  });
}
