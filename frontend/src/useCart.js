import { useEffect, useRef, useState } from 'react';
import { apiRequest, bookView } from './api';

function cartView(data) {
  if (!Array.isArray(data.items) || !Number.isFinite(data.total)) throw new Error('Respuesta del carrito inválida.');
  return { items: data.items.map((item) => ({
    ...(item.libro ? bookView(item.libro) : { title: 'Libro retirado del catálogo', price: 0 }),
    price: item.libro ? Math.round(item.libro.precio * 100) / 100 : 0,
    id: item.id_libro, quantity: item.cantidad, subtotal: item.subtotal,
    available: item.disponible, reason: item.motivo,
  })), total: data.total };
}

export default function useCart(user) {
  const identity = user ? String(user.id || user._id || user.email) : '';
  const scope = useRef(null);
  const [state, setState] = useState({ identity: '', items: [], total: 0, loading: false, busy: false, error: '' });
  async function request(session, path = '/cart', options = {}) {
    if (!session?.active || session.identity !== identity || session.pending) return false;
    if (options.method && session.needsReload) return false;
    session.pending = true;
    const reading = !options.method;
    setState((current) => ({ ...current, identity: session.identity, error: '', loading: reading, busy: !reading }));
    try {
      const data = cartView(await apiRequest(path, { ...options, auth: true }));
      if (!session.active || scope.current !== session) return false;
      session.needsReload = false;
      setState({ identity: session.identity, ...data, loading: false, busy: false, error: '' });
      return reading ? data : true;
    } catch (error) {
      session.needsReload = true;
      if (session.active && scope.current === session) setState((current) => ({ ...current, error: error.message,
        loading: false, busy: false, ...(reading ? { items: [], total: 0 } : {}) }));
      return false;
    } finally { session.pending = false; }
  }
  useEffect(() => {
    const session = { identity, active: true, pending: false, needsReload: true };
    scope.current = session;
    setState({ identity, items: [], total: 0, loading: Boolean(identity), busy: false, error: '' });
    if (identity) void request(session);
    return () => { session.active = false; };
    // La identidad, no los cambios de nombre del perfil, determina el carrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);
  const current = state.identity === identity ? state : { items: [], total: 0, loading: Boolean(identity), busy: false, error: '' };
  async function checkout(key, method) {
    const session = scope.current;
    if (!session?.active || session.pending) return;
    session.pending = true;
    setState((current) => ({ ...current, busy: true }));
    try {
      const storageKey = 'checkout:' + session.identity;
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        try {
          const pending = JSON.parse(saved);
          if (pending.method !== 'paypal') key = pending.key;
        }
        catch { key = saved; }
      }
      sessionStorage.setItem(storageKey, JSON.stringify({ key, method }));
      const order = await apiRequest('/orders', { method: 'POST', auth: true, body: { clave_compra: key, metodo_pago: method } });
      if (!session.active || scope.current !== session) return;
      sessionStorage.removeItem(storageKey);
      try {
        const data = cartView(await apiRequest('/cart', { auth: true }));
        if (!session.active || scope.current !== session) return;
        session.needsReload = false;
        setState({ identity: session.identity, ...data, loading: false, busy: false, error: '' });
      } catch {
        if (!session.active || scope.current !== session) return;
        session.needsReload = true;
        setState((current) => ({ ...current, error: 'Compra confirmada. Recarga el carrito para actualizarlo.' }));
      }
      return order;
    } catch (error) {
      if (session.active && scope.current === session) {
        session.needsReload = true;
        let updated;
        if (error.status === 409) {
          try {
            updated = cartView(await apiRequest('/cart', { auth: true }));
          } catch { /* Si falla la consulta, conserva lo que ya mostraba el carrito. */ }
        }
        if (session.active && scope.current === session) {
          session.needsReload = !updated;
          setState((current) => ({ ...current, ...updated, error: updated ? '' : error.message }));
        }
      }
      throw error;
    } finally {
      session.pending = false;
      if (session.active && scope.current === session) setState((current) => ({ ...current, busy: false }));
    }
  }
  return { ...current, checkout,
    reload: () => identity && request(scope.current),
    add: (id) => request(scope.current, '/cart/items', { method: 'POST', body: { id_libro: id, cantidad: 1 } }),
    change: (id, cantidad) => request(scope.current, '/cart/items/' + id, { method: 'PATCH', body: { cantidad } }),
    remove: (id) => request(scope.current, '/cart/items/' + id, { method: 'DELETE' }),
  };
}
