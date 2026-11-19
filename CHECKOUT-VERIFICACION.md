# Verificación técnica del checkout

Para el recorrido del cliente, consulta [Comprar y consultar pedidos](MANUAL-USUARIO.md#comprar-y-consultar-pedidos).

## Atribución histórica de ventas

Cada artículo de un pedido nuevo conserva el vendedor leído del catálogo
al confirmar. Los reportes históricos usan ese dato y mantienen el título
y las unidades guardados aunque el libro cambie o se elimine. En pedidos
mixtos, cada vendedor consulta solo sus artículos. Si el libro no tiene
propietario al confirmar, se registra un vendedor nulo.

Para artículos antiguos que carecen del campo de vendedor, los reportes usan
el propietario registrado en el libro asociado si sigue en el catálogo. Si
el libro desapareció o carece de propietario verificable, sus unidades quedan
sin atribuir. Los reportes de inventario usan el catálogo actual.

## Alcance y entorno

El checkout registra pedidos sin pasarela ni cargos. El navegador valida el
formato de los campos de tarjeta. No consulta a un banco ni envía, guarda o
registra esos campos. Los pedidos por SPEI y efectivo quedan pendientes de pago
y la interfaz muestra el folio en lugar de la referencia interna. Los pedidos
históricos conservan sus datos. La aplicación funciona sin credenciales de PayPal.

Confirmar con tarjeta descuenta las unidades en la misma transacción que
guarda el pedido y vacía el carrito. SPEI y efectivo pendientes no reservan
existencias. Una clave repetida devuelve el mismo pedido. Si se agota algún
libro, se revierte la operación completa y el carrito se conserva.

Para comprobarlo, prepara un libro habilitado con 5 unidades. Compra 2 con
tarjeta y comprueba 3 en el inventario del vendedor. Compra las 3 restantes
y comprueba **Agotado** en el catálogo y la ficha. Repón unidades con el libro
desactivado y comprueba que aparece **No disponible** hasta habilitarlo. Con
dos cuentas y una última unidad en ambos carritos, confirma simultáneamente
y comprueba que solo se registra un pedido y que el otro carrito se conserva.

Para la prueba manual usa una base local desechable con un replica set
`rs0` activo. Configura las variables en una terminal de PowerShell, desde
`backend`, sin editar `backend/.env`:

```powershell
$env:MONGO_URI = 'mongodb://127.0.0.1:27017/progwebii_checkout_test?replicaSet=rs0'
$env:JWT_SECRET = 'clave-local-de-pruebas-con-suficiente-longitud'
npm.cmd start
```

En otra terminal, desde `frontend`, ejecuta `npm.cmd run dev` y abre la URL
que indique Vite. Prepara cuentas de prueba y libros disponibles. Usa
exclusivamente datos ficticios.

## Diseño y navegación

1. Añade al carrito un libro con portada y otro sin portada. Pulsa **Realizar
   Compra**. En escritorio, comprueba **Método de pago** a la izquierda y
   **Resumen del pedido** a la derecha. En la vista móvil de DevTools comprueba
   el orden apilado y que no haya desplazamiento horizontal.
2. Revisa portada o marcador neutro, título, cantidad e importe por libro en
   MXN. Comprueba que los importes estén alineados y el total encima del botón.
3. Cambia entre los tres métodos. Comprueba el icono, la selección y que solo se
   expanda el método activo. Verifica en la pestaña Red que cambiar de método
   no envía un POST. Pulsa **Volver al carrito** y revisa cantidades y total.

## Tarjeta de crédito o débito

1. Escribe los ejemplos a mano en pedidos separados:

   | Titular | Número ficticio | Vencimiento | CVV |
   | --- | --- | --- | --- |
   | Lucía | `4111 1111 1111 1111` | Mes y año actuales | `012` |
   | Ángela D’Ávila | `4012888888881881` | Un mes posterior | `987` |

   Introduce cuatro dígitos en vencimiento y comprueba la inserción de la barra.
   Pega también un número con espacios. En móvil, número, vencimiento y CVV
   deben ofrecer teclado numérico.
2. Prueba un titular numérico, 15 y 17 dígitos, el control incorrecto
   `4111111111111112`, los meses `00` y `13`, el mes anterior y CVV de 2 o 4
   dígitos. Comprueba el error debajo del campo al salir después de editarlo y al
   pulsar **Confirmar pedido**. El número de 17 dígitos debe conservarse para
   mostrar el error. Corrige un campo y verifica que los demás mantengan sus valores.
3. Con cada ejemplo válido, pulsa **Confirmar pedido**. Espera **Pedido
   confirmado**, el folio `LIB-…`, método y total. En Red, comprueba que
   `POST /api/orders` solo envía `clave_compra` y `metodo_pago: tarjeta`. Revisa
   que ninguno de los cuatro campos aparezca en el almacenamiento del navegador.

## Transferencia SPEI

1. Añade un libro a un carrito nuevo. Elige **Transferencia SPEI** y pulsa
   **Registrar pedido**.
2. Comprueba **Pedido registrado**, **Pendiente de pago**, folio, método y total.
   La vista debe mostrar el folio sin referencia interna, CLABE ni instrucciones
   para transferir.

## Pago en efectivo

1. Con otro carrito, elige **Pago en efectivo** y pulsa **Registrar pedido**.
2. Comprueba **Pedido registrado**, **Pendiente de pago**, folio, método y total.
   La vista debe mostrar el folio sin referencia interna ni instrucciones de pago.

## Historial, errores y reintentos

- Pulsa **Ver mis pedidos** en cada confirmación. Ubica el mismo folio y
  verifica estado, total, fecha y método. Abre **Libros del pedido** y compara
  títulos y cantidades. Recarga, vuelve a **Mis pedidos** y comprueba que se
  mantienen los mismos valores. Revisa un pedido histórico si existe en la base
  de pruebas. Con otra cuenta, confirma que los folios de la primera no aparecen.
- Confirma con doble clic y verifica que se crea un solo pedido. Repite la
  petición con la misma clave y comprueba que se devuelve el mismo folio.
- Prueba un error de red o deja un libro sin disponibilidad antes de confirmar.
  Comprueba el mensaje de error y que no se pierda el carrito ante un rechazo.
  Si la respuesta se pierde, revisa el historial antes de volver a intentar.

## Automatización

Desde `frontend`, ejecuta `npm.cmd test` y `npm.cmd run build`. Las pruebas
usan HTTP simulado y cubren la captura, Luhn, el contrato del POST, los estados,
la protección contra doble confirmación y el historial. Desde `backend`,
`npm.cmd test` comprueba, entre otros casos, el total calculado en el servidor,
el rollback, el aislamiento por cuenta y el folio. Las pruebas automatizadas
usan dobles y no escriben en Atlas.
