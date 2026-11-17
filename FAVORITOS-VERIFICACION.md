# Favoritos persistentes

## Funcionamiento

- `GET /api/favorites`: lista de la cuenta autenticada, con datos actuales del
  catálogo. Si se retiró un libro, conserva su referencia para poder quitarlo.
- `PUT /api/favorites/:id_libro`: guarda un libro existente; repetir la solicitud
  no agrega otra fila. No recibe propietario ni otros campos en el cuerpo.
- `DELETE /api/favorites/:id_libro`: quita solo de la cuenta autenticada; repetir
  la eliminación es válido, incluso si el libro ya no existe.

Se reutilizan Favorite, authenticate, apiRequest y bookView. Hay un índice único
por usuario/libro y un ID determinista para proteger altas concurrentes mientras
se crea el índice. No se modifican los permisos por rol: cualquier cuenta
autenticada administra exclusivamente sus favoritos.

El estado compartido en Inicio sincroniza los corazones del catálogo, el detalle,
el carrito y la Lista de deseos. Se actualiza después de confirmar la API; los
errores conservan la lista confirmada y permiten reconsultarla. No hay respaldo
de ejemplo. Cerrar sesión limpia la interfaz sin borrar registros. Se descartan
las respuestas pendientes de sesiones anteriores.

## Automatización segura

En PowerShell, desde `backend`: `npm.cmd test`.
Desde `frontend`: `npm.cmd test` y `npm.cmd run build`.

Las pruebas montan rutas aisladas y sustituyen los modelos por dobles en memoria;
no importan server.js, no cargan backend/.env y no conectan a MongoDB ni escriben
en Atlas. Cubren alta, eliminación, reintentos, concurrencia, autenticación,
aislamiento entre cuentas, restauración al iniciar sesión, sincronización visual,
respuesta tardía de otra sesión y errores sin datos de ejemplo. Las suites
anteriores siguen verificando compra, historial, carrito y vendedor.

## Prueba manual con dos cuentas

1. Usar exclusivamente una base desechable de pruebas y dos cuentas A y B.
   Sin editar `backend/.env`, abrir una terminal en `backend` y establecer las
   variables del proceso antes de `npm.cmd start`:

   ```powershell
   $env:MONGO_URI = 'mongodb://127.0.0.1:27017/progwebii_favorites_test?replicaSet=rs0'
   $env:JWT_SECRET = 'clave-local-de-pruebas-con-suficiente-longitud'
   npm.cmd start
   ```

   La instancia local debe estar disponible; el replica set `rs0` también permite
   probar las transacciones de compra. No apuntar a producción. En otra terminal,
   desde `frontend`, ejecutar `npm.cmd run dev` y abrir la URL indicada por Vite.
   Preparar libros mediante el flujo existente de vendedor en esa base.
2. Sin sesión, pulsar un corazón: debe solicitar iniciar sesión, sin guardar.
3. Entrar con A y guardar un libro desde el catálogo. Ambos carruseles deben
   marcarlo. Abrir el detalle y comprobar su estrella. Verlo en Mi perfil →
   Deseados y Comprados → Lista de Deseos. No deben aparecer libros de ejemplo.
4. Recargar, cerrar sesión y volver a entrar con A: debe conservarse la lista.
   Quitar desde el perfil, cerrar el perfil y comprobar que el catálogo ya no
   lo marca, sin recargar. Repetir desde el detalle y desde el corazón del carrito.
5. Guardar otro libro con A. Cerrar sesión y entrar con B: la lista debe ser propia,
   inicialmente vacía. Guardar el mismo libro y después quitarlo con B. Volver a
   A: su favorito debe permanecer. Alternar cuentas con una petición lenta para
   confirmar que no se muestran resultados de la sesión anterior.
6. En DevTools, repetir `PUT /api/favorites/:id_libro` con el mismo token y libro:
   debe devolver 204 y quedar una sola fila. Repetir DELETE también devuelve 204.
   Sin token devuelve 401; libro inexistente al guardar devuelve 404; un cuerpo
   con `id_usuario` devuelve 400. En la base de pruebas verificar el índice único
   compuesto de favorites y la persistencia de las filas.
7. Simular fallo de red: mostrar error sin agregar favoritos ficticios. Restaurar
   conexión y pulsar Reintentar favoritos. Si falla al quitar, mantener el libro
   visible hasta confirmar la API. Retirar un libro del catálogo y comprobar que
   aparece como retirado en la lista y aún se puede quitar.
8. Verificar como regresión una compra simulada, su historial y la persistencia
   del carrito. Con vendedor, comprobar acceso al panel y operaciones existentes.

La conexión real a MongoDB, sus índices y la interacción manual quedan para esta
verificación en navegador; no se ejecutan mediante las pruebas automatizadas.
