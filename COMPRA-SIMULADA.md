# Compra simulada

La API `POST /api/orders` recibe únicamente `clave_compra` (UUID). Obtiene la
cuenta del token, lee su carrito y vuelve a consultar el catálogo. Guarda fecha
(`createdAt`), estado `simulado`, método `Tarjeta de prueba`, total y copias del
título, precio unitario y cantidad. `GET /api/orders` filtra por la cuenta
autenticada, sin usar pedidos de ejemplo ni poblar datos desde el catálogo.

El pedido y el vaciado del carrito se confirman en una transacción MongoDB.
Se requiere un replica set o clúster con soporte de transacciones; un servidor
standalone devuelve error y conserva el carrito. La versión del carrito evita
sobrescribir cambios concurrentes. La clave tiene un índice único por cuenta;
los reintentos devuelven el pedido existente. El navegador conserva una clave
pendiente por cuenta en sessionStorage y bloquea la confirmación simultánea.

No se descuenta stock: las reglas anteriores solo verificaban disponibilidad y
existencias al modificar el carrito. Esta tarea conserva esa política; decidir
si una simulación debe consumir inventario queda pendiente de producto.
No se solicitan ni guardan datos bancarios y no hay pasarela.

## Pruebas automatizadas en PowerShell

Desde `backend`: `npm.cmd test`.
Desde `frontend`: `npm.cmd test` y `npm.cmd run build`.
Vitest usa un solo worker para evitar timeouts por carga al montar las vistas
de Material UI simultáneamente en Windows.
Las pruebas del backend sustituyen los modelos y las transacciones por dobles
en memoria: no cargan `.env`, no abren conexión MongoDB y no escriben en Atlas.
Cubren éxito, errores de disponibilidad y guardado, rollback, doble confirmación,
reintentos e historial por cuenta. La transacción real requiere verificación manual.

## Verificación en navegador con base de pruebas

1. Usar exclusivamente una base desechable de pruebas con replica set y cuentas
   de pruebas, nunca la base de producción. No modificar `backend/.env`.
   En una terminal nueva, desde `backend`, configurar variables del proceso:
   `$env:MONGO_URI = 'mongodb://127.0.0.1:27017/progwebii_compra_test?replicaSet=rs0'`
   y `$env:JWT_SECRET = 'clave-local-de-pruebas-con-suficiente-longitud'`.
   La instancia local debe estar iniciada como replica set `rs0`.
   Ejecutar `npm.cmd start`. dotenv respeta las variables ya establecidas.
2. Desde `frontend`, en otra terminal, ejecutar `npm.cmd run dev` y abrir la URL
   que indique Vite. Crear dos cuentas de pruebas. Preparar categoría y libros
   con stock en esa misma base usando los permisos y el panel existentes.
3. Iniciar sesión con la cuenta A, agregar libros y ajustar cantidades. Abrir
   «Realizar Compra»: comprobar libros, cantidades, total, método único y aviso
   de simulación. No debe aparecer ningún campo para tarjeta.
4. Confirmar (también intentar doble clic). Anotar el número de pedido y verificar
   que el carrito se vacía. En Mi perfil → Deseados y Comprados, comprobar fecha,
   estado, método, detalles y total. Recargar y volver a iniciar sesión: debe
   seguir visible una sola vez.
5. Cambiar título/precio del libro desde el panel del vendedor de pruebas. El
   historial debe conservar los valores de compra y el stock no debe descontarse.
6. Agregar otro libro y reducir su stock o deshabilitarlo desde el catálogo antes
   de confirmar. La compra debe fallar sin generar pedido ni vaciar el carrito.
   Cerrar el resumen y usar Reintentar para actualizar el carrito; ajustar o
   eliminar los artículos bloqueados. También probar un fallo de red y reintentar.
7. Iniciar sesión con B: no debe ver los pedidos ni el carrito de A. Comprar con B
   y verificar ambos historiales al alternar cuentas.
8. En DevTools, repetir el POST con la misma `clave_compra`: debe devolver el mismo
   número sin borrar artículos añadidos después. Enviar `total` o `id_usuario`
   debe producir 400. Sin token, GET/POST deben producir 401.

Estas comprobaciones manuales no se ejecutan mediante la suite automatizada.
