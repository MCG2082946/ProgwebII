//Apartado o Funcion Gral de Rutas

import React, { useEffect, useState } from 'react';
import { API_URL } from './api';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Inicio from './Inicio';
import DashboardVendedor from './DashboardVendedor';
import NotExist from './NotExists';

function App() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null); 
  const [sessionVersion, setSessionVersion] = useState(0);
  const [loadingSession, setLoadingSession] = useState(() => Boolean(localStorage.getItem('token')));
  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('token');
    if (!token) {
      return () => controller.abort();
    }
    async function restoreSession() {
      try {
        const response = await fetch(API_URL + '/auth/me', {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
        });
        if (response.status === 401) {
          localStorage.removeItem('token');
          return;
        }
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted) setUser(data.usuario);
      } catch {
        // Una falla temporal de red no debe borrar una sesión válida.
      } finally {
        if (!controller.signal.aborted) setLoadingSession(false);
      }
    }
    void restoreSession();
    return () => controller.abort();
  }, []);
  const handleLogout = () => {
    // El token es el único dato de sesión persistido por la aplicación.
    localStorage.removeItem('token');
    setUser(null);
    // Desmontar la tienda elimina carrito, compras y formularios de la sesión anterior.
    setSessionVersion((version) => version + 1);
    navigate('/', { replace: true });
  };
  if (loadingSession) return null;
  return (
    <Routes>
      {/* Ruta Tienda / Cliente */}
      <Route 
        path="/" 
        element={<Inicio key={sessionVersion} user={user} setUser={setUser} onLogout={handleLogout} />}
      />

      {/* Ruta Vendedor (Protegida) */}
      <Route 
        path="/vendedor" 
        element={
          user?.rol === 'vendedor' ? (
            <DashboardVendedor user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/" replace />
          )
        } 
      />

      <Route path="*" element={<NotExist />} />
    </Routes>
  );
}

export default App;
