# Carrito persistente

## Diagnóstico y reutilización

Al comenzar, la rama era feature/carrito-persistente y git status estaba limpio.
Existían el modelo Cart, Book con precio/stock/disponibilidad, autenticación JWT,
apiRequest, botones de catálogo/detalle, Navbar y CartDrawer. No había rutas del
carrito: lista, cantidades y eliminación solo modificaban estado de Inicio.
El botón de compra simulaba éxito y añadía libros a un historial local.

Se reutilizan esos componentes, estilos, modelo y sesión. El nuevo hook useCart
carga desde API al restaurar/iniciar sesión, montar la tienda y abrir el drawer.
No guarda carritos en localStorage. Lista, contador y total se actualizan juntos
con la respuesta confirmada. Los errores no sustituyen datos por ejemplos.
Cerrar sesión o cambiar de cuenta limpia la vista; las respuestas tardías de una
cuenta anterior no actualizan la sesión nueva. No se borra el carrito al salir.

## Rutas y contrato

Todas requieren Bearer JWT y usan exclusivamente req.user._id. Se mantiene el
acceso que antes tenía cualquier sesión autenticada en la tienda; no se cambia
ningún rol ni permiso de vendedor, perfil o inventario.

| Ruta | Cuerpo | Resultado |
| --- | --- | --- |
| GET /api/cart | Ninguno | Carrito propio o items vacío y total 0; no crea documentos |
| POST /api/cart/items | { id_libro, cantidad } | Agrega o suma cantidad a la fila existente |
| PATCH /api/cart/items/:id | { cantidad } | Reemplaza cantidad de una fila propia; 404 si no existe |
| DELETE /api/cart/items/:id | Ninguno | Quita la fila propia, incluso si el libro ya no existe |

POST/PATCH exigen cantidad numérica, entera segura y mayor a cero; rechazan
campos extra, incluidos id_usuario, precio, total y subtotal. Cantidades inválidas
devuelven 400; libro inexistente 404; sin disponibilidad o con stock insuficiente
409. Ninguna operación descuenta ni reserva inventario. Eliminar es idempotente.
DELETE tampoco acepta cuerpo con campos adicionales.

Cada respuesta contiene { items, total }. Cada fila incluye id_libro, cantidad,
libro (datos públicos actuales del catálogo o null), disponible, motivo y
subtotal. Los importes se calculan en el servidor a centavos con el precio actual
del catálogo; nunca se toman del navegador ni del subtotal guardado. MongoDB
conserva cantidades y una copia de los importes, recalculada al modificar; GET
recalcula aunque haya cambiado el precio desde el último guardado.

## Disponibilidad y concurrencia

Un libro eliminado sigue visible como «Libro retirado del catálogo». Si está
deshabilitado, sin stock o supera las existencias, permanece visible con aviso,
pero su fila completa no se incluye en el total. El contador sigue contando las
unidades de todas las filas visibles. Se puede eliminar siempre; si aún existe
stock, Reducir permite ajustar directamente a las existencias actuales. No se
reduce ni se elimina una cantidad automáticamente al consultar.

Cart tiene índice único por id_usuario; los documentos nuevos usan además el
identificador de la cuenta como _id para proteger la primera creación concurrente.
Las modificaciones filtran propietario y versión __v; si otra pestaña cambia el
documento, se relee y reintenta hasta cinco veces. Un conflicto persistente devuelve
409. No se pierde una suma ni se crea una segunda fila por agregar el mismo libro
desde dos pestañas. No hay transacción con inventario: agregar no reserva stock;
su disponibilidad se comprueba nuevamente en cada consulta/operación.

Durante una solicitud se bloquean cambios duplicados de la misma interfaz. Ante
un error, Reintentar vuelve a consultar antes de permitir otra modificación:
si hubo una escritura pero se perdió la respuesta, no se repite la suma a ciegas.
La compra simulada se retiró: «Realizar Compra» queda deshabilitado y explica que
la compra todavía no está habilitada. No se crean pedidos, pagos ni compras.
Los favoritos y su interfaz anterior no se implementan ni se modifican aquí.

## Pruebas automáticas

En PowerShell:

1. Desde backend: `npm.cmd test`.
2. Desde frontend: `npm.cmd test` y `npm.cmd run build`.

Las pruebas de backend arrancan Express con Mongoose sustituido, sin importar
server.js ni cargar .env. Prueban lectura, suma sin duplicados, cambios, eliminación,
dos cuentas, campos protegidos, cantidades inválidas, stock/disponibilidad,
libros eliminados, recálculo de precios, conflictos y errores privados.
Las de frontend sustituyen HTTP y prueban restaurar sesión, nueva consulta tras
montaje, contador/total, modificaciones confirmadas, logout y login con otra
cuenta, ausencia de escritura al salir, visitante, fallos/reintentos, bloqueos,
respuestas tardías y libros retirados o con stock reducido.

Resultado final: backend 42/42 pruebas aprobadas; frontend 37/37 en cinco archivos;
compilación aprobada con aviso de bundle mayor a 500 kB (635.95 kB).
`git diff --check` sin errores.

No se realizaron conexiones ni escrituras automatizadas en Atlas. No se abrió ni
modificó backend/.env. Estas pruebas no sustituyen la aceptación manual en una
base de pruebas real ni la revisión visual en navegador.

## Prueba manual con dos cuentas

Usar la configuración de pruebas ya preparada y dos cuentas comprador A y B.
Usar un libro de prueba con disponibilidad activa y al menos cinco existencias.
No usar producción ni borrar documentos ajenos para fabricar un caso.

1. En dos terminales, ejecutar `npm.cmd start` desde backend y `npm.cmd run dev`
   desde frontend. Abrir la URL que indique Vite. Como visitante, agregar un libro:
   debe pedir iniciar sesión y no enviar escrituras al carrito.
2. Entrar como A. Agregar el libro desde el catálogo y nuevamente desde su detalle.
   Abrir Carrito: debe haber una fila con cantidad dos, contador dos y total
   correspondiente al precio del servidor. Recargar y comprobar persistencia.
3. Aumentar y reducir cantidad. La lista, contador y total deben cambiar al
   confirmarse la solicitud. En cantidad uno, Reducir queda deshabilitado; usar
   Eliminar para quitarlo. Recargar y confirmar que continúa eliminado.
4. Como A, volver a agregar dos unidades. Cerrar sesión y comprobar que la interfaz
   queda vacía. Entrar como B: no debe aparecer el carrito de A. Agregar una unidad
   como B, salir y volver a A: A debe conservar dos; B debe conservar una.
   Confirmar documentos separados por id_usuario en la base de pruebas.
5. En una herramienta HTTP privada, con el token de B, enviar id_usuario de A en
   POST/PATCH: esperar 400. GET y DELETE con el token B solo afectan a B, sin poder
   elegir cuenta mediante parámetros. Sin token, esperar 401. Probar 0, -1, 1.5,
   "2" y cantidad superior al stock: 400 para tipos/cantidades inválidas, 409 para
   stock insuficiente. Probar precio o total en el cuerpo: 400.
6. Con dos pestañas de A, agregar el mismo libro casi simultáneamente. Consultar
   después y comprobar una sola fila y la suma de cantidades, sin superar stock.
7. Con el flujo existente del vendedor y solo sobre el libro de prueba, bajar stock
   por debajo de la cantidad de A. Reabrir el carrito: debe aparecer aviso y total
   sin esa fila. Reducir debe ajustar al stock disponible. Cambiar precio y reabrir:
   el total debe utilizar el precio nuevo. El stock no debe bajar por agregar.
8. Marcar ese libro de prueba como no disponible (o eliminar exclusivamente ese
   libro de prueba mediante el CRUD existente). Reabrir carrito: conservar fila,
   aviso y eliminación habilitada, sin importe en total. Eliminarla y recargar.
9. Bloquear GET /api/cart con DevTools y abrir el carrito: mostrar error y Reintentar,
   sin ejemplos ni un falso estado vacío. Desbloquear y reintentar. Bloquear una
   modificación: no mostrar éxito, conservar última respuesta confirmada y volver
   a consultar antes de modificar de nuevo. Con red lenta, ver Cargando/Guardando
   y comprobar que no permite duplicar la misma solicitud.
10. Confirmar que «Realizar Compra» permanece deshabilitado, que Mi perfil y el
    panel de vendedor conservan su funcionamiento y que el drawer se acomoda en
    móvil. No se espera crear pedidos, favoritos ni pagos durante esta prueba.
