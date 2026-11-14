export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

export async function apiRequest(path, { auth = false, body, ...options } = {}) {
  const headers = {};
  if (auth) headers.Authorization = `Bearer ${localStorage.getItem('token') || ''}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(API_URL + path, {
    ...options, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.mensaje || 'No se pudo completar la solicitud.');
  return data;
}

export function bookView(book) {
  return {
    ...book, id: book._id, title: book.titulo, author: book.autor,
    price: book.precio, cover: book.portada_url || undefined,
    categoryId: book.categoria?._id || book.categoria || '',
    binding: book.tipoTapa === 'dura' ? 'Tapa dura' : 'Tapa blanda',
  };
}

export async function loadCatalog({ mine = false, signal } = {}) {
  const [books, categories] = await Promise.all([
    apiRequest(mine ? '/books/mine' : '/books', { auth: mine, signal }),
    apiRequest('/categories', { signal }),
  ]);
  if (!Array.isArray(books) || !Array.isArray(categories)) throw new Error('Respuesta del catálogo inválida.');
  return { books: books.map(bookView), categories };
}
