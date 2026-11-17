import { useEffect, useRef, useState } from 'react';
import { apiRequest, bookView } from './api';

function listView(data) {
  if (!Array.isArray(data)) throw new Error('Respuesta de favoritos inválida.');
  return data.map((item) => item.libro ? bookView(item.libro) : {
    id: item.id_libro, title: 'Libro retirado del catálogo', author: '',
  });
}

export default function useFavorites(user) {
  const identity = user ? String(user.id || user._id || user.email) : '';
  const scope = useRef(null);
  const [state, setState] = useState({ identity: '', items: [], loading: false, busy: false, error: '' });
  async function request(session, id, remove = false) {
    if (!session?.active || session.pending) return false;
    session.pending = true;
    const reading = !id;
    const current = () => session.active && scope.current === session;
    setState((prev) => ({ ...prev, error: '', loading: reading, busy: !reading }));
    try {
      if (id) await apiRequest('/favorites/' + encodeURIComponent(id), { auth: true, method: remove ? 'DELETE' : 'PUT' });
      if (!current()) return false;
      const items = listView(await apiRequest('/favorites', { auth: true }));
      if (!current()) return false;
      setState({ identity: session.identity, items, loading: false, busy: false, error: '' });
      return true;
    } catch (error) {
      if (current()) setState((prev) => ({ ...prev, loading: false, busy: false, error: error.message }));
      return false;
    } finally { session.pending = false; }
  }
  useEffect(() => {
    const session = { identity, active: true, pending: false };
    scope.current = session;
    setState({ identity, items: [], loading: Boolean(identity), busy: false, error: '' });
    if (identity) void request(session);
    return () => { session.active = false; };
  }, [identity]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = state.identity === identity ? state : { items: [], loading: Boolean(identity), busy: false, error: '' };
  return { ...current,
    has: (id) => current.items.some((item) => item.id === id),
    reload: () => identity && request(scope.current),
    save: (id) => identity && request(scope.current, id),
    remove: (id) => identity && request(scope.current, id, true),
  };
}
