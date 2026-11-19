# Seguridad y autenticación: fase 1

## Configuración

Ejecutar el backend desde `backend/`, con `node server.js`. Se requieren
`MONGO_URI` y `JWT_SECRET` en el entorno o en el `.env` local. Este archivo no
debe compartirse ni versionarse. Usar un secreto aleatorio fuerte, exclusivo
de este proyecto. El servidor valida las variables antes de conectar o escuchar;
no imprime sus valores ni errores internos de conexión.

El frontend admite `VITE_API_URL` (por defecto `http://localhost:5000/api`).
Nunca poner secretos del backend en variables `VITE_`: son públicas.

## Roles y habilitación de vendedores

El contrato de usuario es `{ id, nombre, email, rol }`; los roles son `cliente`,
`vendedor` y `administrador`. No se utiliza ninguna clave compartida de vendedor.

1. La persona se registra normalmente: siempre obtiene una cuenta de cliente.
2. Un administrador existente verifica la solicitud e identidad por un canal
   de confianza y obtiene el identificador de la cuenta aprobada.
3. En **Panel de administración → Habilitar vendedores**, busca el correo
   exacto y confirma la cuenta. El panel llama a
   `PATCH /api/auth/usuarios/:id/vendedor` con la sesión del administrador.
4. El endpoint solo transforma clientes en vendedores. No crea administradores.
   La persona habilitada vuelve a iniciar sesión o recarga para actualizar su perfil.

Si aún no existe un administrador, el responsable de la base debe provisionar
uno fuera del registro público, con acceso administrativo de confianza y tras
verificar la identidad de la cuenta. No hay un endpoint público de bootstrap
ni una contraseña maestra. Esta fase no crea ni promueve ninguna cuenta real.

Los permisos se consultan en la base en cada petición autenticada, incluyendo
`GET /api/auth/me`. Cambiar un rol en la base afecta también a tokens existentes.

## Permisos

| Operación | Permiso |
| --- | --- |
| Leer libros/categorías | Público |
| Crear libros/categorías | Vendedor o administrador |
| Actualizar/borrar libro | Vendedor propietario o administrador |
| Actualizar/borrar categoría | Administrador |
| Habilitar vendedor | Administrador |

Los libros nuevos reciben el vendedor desde la sesión, nunca desde el cuerpo.
Los libros anteriores sin propietario solo pueden modificarse por administradores;
esta fase no migra datos. El borrado de categorías con libros se rechaza con 409.
La comprobación de referencias no es una transacción: el control de concurrencia
de catálogo queda para una fase posterior.

## HTTP y validaciones

- 400: entrada inválida, ID inválido o JSON malformado.
- 401: falta autenticación, token inválido/vencido o credenciales incorrectas.
- 403: permisos insuficientes o intento de registro con rol elevado.
- 404: recurso inexistente o libro ajeno; no revela la propiedad de otros libros.
- 409: duplicado, categoría en uso o cuenta no habilitable.
- 413: cuerpo demasiado grande. 500: mensaje genérico sin detalles internos.

El registro requiere contraseña de al menos ocho caracteres y como máximo 72
bytes UTF-8, por el límite de bcrypt. El login conserva compatibilidad con
contraseñas anteriores más cortas. Los emails se recortan pero conservan su
capitalización para no cambiar la búsqueda de cuentas existentes sin migración.

## Verificación local sin base real

Con una versión de Node.js compatible con las dependencias instaladas, ejecutar desde `backend/`:
`node --test tests/security.test.js`. Las pruebas montan una app aislada y
sustituyen los métodos de Mongoose; no cargan `.env`, no importan `server.js`
y no conectan a MongoDB. Usan exclusivamente claves efímeras generadas en memoria.
Para el frontend ejecutar `npm run lint` y `npm run build` desde `frontend/`.

## Alcance pendiente

El catálogo y el inventario del vendedor consultan la API. El inventario usa
`GET /api/books/mine`, autenticado y filtrado por propietario. Las escrituras
reutilizan POST, PATCH y DELETE de libros. El carrito sigue siendo local.
El perfil visual no actualiza la base ni
cambia contraseñas. Quedan pendientes límites de intentos de login y despliegue
con HTTPS, política CORS específica y revisión del almacenamiento del token.

Excluir `.env` no elimina copias del historial. Si hubo secretos reales
versionados, el responsable debe rotarlos antes de desplegar. No reescribir
el historial compartido sin coordinación.

## Bitácora del backend

Al ejecutar `npm.cmd start` (o `npm start`) desde `backend/`, se genera
`backend/logs/backend.log`. La bitácora registra el inicio y el resultado
del arranque del servidor, el registro de pedidos y la habilitación de
vendedores, además de los errores internos de HTTP. Cada línea es un
objeto JSON con fecha UTC y evento. Las operaciones HTTP incluyen un ID
aleatorio de correlación y, al terminar, su estado HTTP si está disponible.

No se registran correos, credenciales, datos de tarjeta, cuerpos de las
peticiones, rutas ingresadas por usuarios ni mensajes internos de errores.
El archivo se ignora en Git. Si no se puede escribir, se avisa en la
consola sin interrumpir la operación de la tienda.

Para verificarlo, registra un pedido en la base de pruebas y abre el
archivo desde `backend/` en PowerShell:

```powershell
Get-Content .\logs\backend.log -Tail 15
```

Busca las entradas `compra` de `inicio` y `fin` con el mismo valor de
`operacion`. La segunda incluye el resultado. Las pruebas automatizadas
escriben solo en un directorio temporal, no en la bitácora de la aplicación.
