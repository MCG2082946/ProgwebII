//Apartado o Funcion Gral de Rutas

import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Inicio from './Inicio';
import DashboardVendedor from './DashboardVendedor';
import NotExist from './NotExists';

function App() {

  const [user, setUser] = useState(null); 
  return (
    <Routes>
      {/* Ruta Tienda / Cliente */}
      <Route 
        path="/" 
        element={<Inicio user={user} setUser={setUser} />} 
      />

      {/* Ruta Vendedor (Protegida) */}
      <Route 
        path="/vendedor" 
        element={
          user?.role === 'seller' ? (
            <DashboardVendedor user={user} setUser={setUser} />
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