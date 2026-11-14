# CRUD de libros y categorías

## Contrato y permisos

- Públicos: `GET /api/books`, `GET /api/categories`.
- Inventario propio: nuevo `GET /api/books/mine`, vendedor o administrador,
  siempre filtrado por el usuario autenticado.
- Libros: se reutilizan `POST /api/books`, `PATCH /api/books/:id` y
  `DELETE /api/books/:id`. También existe `PUT /api/books/:id`.
  El backend asigna propietario; el vendedor solo modifica sus libros.
- Categorías: ya existen POST, PATCH, PUT y DELETE bajo `/api/categories`.
  Crear requiere vendedor o administrador; editar/eliminar requiere administrador.
  Eliminar una categoría utilizada devuelve 409. No se ampliaron permisos.
- El panel permite crear la primera categoría cuando la consulta termina con
  una lista vacía. Reutiliza `POST /api/categories` autenticado con `{ nombre }`;
  nombre es obligatorio (hasta 200 caracteres) y descripción es opcional.
  La respuesta incluye `{ mensaje, categoria }`; GET devuelve un arreglo directo.
  Editar/eliminar categorías continúa disponible únicamente por API para administrador.

## Comprobación automática

Desde `backend/`: `npm.cmd test`.
Desde `frontend/`: `npm.cmd test` y `npm.cmd run build`.

Resultado de esta corrección (2026-11-13): frontend, 3 archivos de pruebas y
10 pruebas aprobadas; compilación aprobada con aviso de bundle mayor a 500 kB.
No se modificó el backend en esta corrección ni se ejecutó contra MongoDB.

Las pruebas del backend sustituyen Mongoose sin conexión, sin cargar `.env`.
Las del frontend sustituyen HTTP y cubren creación, edición, nuevo montaje,
catálogo público, filtros, eliminación y errores sin respaldo local.
Las pruebas de seguridad comprueban el filtro atómico de propiedad y el rechazo
de edición/borrado ajeno. Estas comprobaciones no equivalen a persistencia real.

## Flujo manual pendiente con MongoDB

No se confirmó una base de desarrollo/pruebas durante esta tarea y no se
realizaron escrituras en MongoDB. Antes de ejecutar este flujo, confirmar con
el responsable que la configuración apunta exclusivamente a una base de
desarrollo o pruebas. No publicar credenciales ni utilizar producción.

1. En PowerShell, desde `backend/`, ejecutar `npm.cmd start` con la configuración
   local ya preparada. Desde `frontend/`, en otra terminal, `npm.cmd run dev`.
   Abrir la URL indicada por Vite. `VITE_API_URL` admite otra ubicación de la API.
2. Usar dos cuentas de vendedor ya habilitadas. Si la base de pruebas está vacía
   de categorías, entrar como vendedora al panel: debe aparecer «No hay categorías»,
   «Crear categoría» y «Agregar Libro» deshabilitado. Pulsar «Crear categoría»:
   comprobar Nombre, Cancelar y Guardar. Probar nombre vacío o solo espacios:
   debe verse la validación sin enviar a la API. Guardar un nombre válido:
   el diálogo cierra y «Agregar Libro» se habilita sin recargar. Abrirlo y comprobar
   que la categoría creada aparece y se puede seleccionar. No borrar categorías
   existentes para forzar este estado; usar una base de pruebas vacía preparada.
3. Iniciar sesión como A, entrar al panel, crear un libro con categoría, precio,
   stock y tapa. Comprobar que aparece sin recargar. Recargar y comprobar que sigue.
4. Editar título, precio y tapa; comprobar tabla, recargar y volver a la tienda.
   Buscar por título/autor y probar filtros de precio, tapa y categoría, además
   de Limpiar. Comprobar también desde una sesión pública nueva.
5. Como B, verificar que el libro de A no aparece en su panel. En una herramienta
   HTTP privada, usar el token de B para PATCH, PUT y DELETE del ID de A:
   esperar 404 y comprobar como A que el libro no cambió.
6. Como A, borrar el libro y comprobar su desaparición de tabla y catálogo,
   también tras recargar.
7. Detener la API y comprobar estados de error y Reintentar sin libros locales.
8. Categorías: vendedor puede crear, pero PATCH/PUT/DELETE deben devolver 403.
   Administrador puede editar y borrar categorías sin libros; con libros, 409.
9. Para probar el error de carga sin escrituras, bloquear la solicitud GET a
   `/api/categories` con las herramientas del navegador y volver a entrar al panel.
   Debe aparecer un error con «Reintentar», sin «No hay categorías» ni «Crear
   categoría», y «Agregar Libro» deshabilitado. Desbloquear y pulsar Reintentar.
10. En la base de pruebas vacía, abrir Crear categoría y bloquear POST a
    `/api/categories` en el navegador antes de guardar. Comprobar el error dentro
    del diálogo, el nombre conservado y Guardar habilitado para reintentar.
    Desbloquear y guardar: durante el envío los controles quedan deshabilitados.

Las pruebas de `frontend/src/categories.test.jsx` simulan HTTP: cubren la primera
categoría, selección al agregar un libro, validación, bloqueo de envíos duplicados,
error de carga con reintento y error de guardado conservando el texto. No escriben
en MongoDB ni requieren credenciales.

Quedan pendientes todas las comprobaciones anteriores contra MongoDB y la
inspección visual en navegador. Las pruebas automáticas no abren un navegador.
