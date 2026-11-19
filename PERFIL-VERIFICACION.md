# Perfil y nombre completo de clientes y vendedores

## Contrato actual

Se conserva el acceso «Mi cuenta» de la tienda y «Mi perfil» del panel, el
mismo modal, el estado de sesión compartido y el CRUD de libros/categorías.

Registro público y PATCH /api/auth/me usan:

- `nombres`: Nombre(s), obligatorio; uno o varios nombres en el mismo campo.
- `primerApellido`: obligatorio; admite apellidos compuestos.
- `segundoApellido`: obligatorio, salvo `sinSegundoApellido: true`; en ese caso
  enviar una cadena vacía. Un apellido y la marca juntos se rechazan.
- `sinSegundoApellido`: booleano explícito, representado por «No tengo segundo
  apellido»; sin marca se exige segundo apellido.
- `email`: editable con formato, longitud máxima 254 y unicidad en MongoDB.

Cada parte del nombre admite hasta 80 caracteres después de normalizar Unicode
NFC, recortar extremos y convertir espacios repetidos en uno. Se admiten letras
Unicode, acentos, ñ, espacios, guiones y apóstrofos internos; se rechazan vacíos,
números, símbolos ajenos al nombre y separadores sin letras a ambos lados.
Los errores aparecen junto al campo y no borran el texto. Al marcar la excepción
con un apellido escrito, se conserva ese texto y se indica la contradicción;
desmarcar permite corregirlo. No se descarta información automáticamente.

MongoDB guarda las cuatro propiedades estructuradas. El backend deriva `nombre`
como lectura compatible para panel, catálogo y sesión. No se admite enviarlo en
registro o edición. El modelo también deriva el nombre al validar documentos
estructurados. GET /api/auth/me e inicio de sesión devuelven los campos públicos
y `nombreIncompleto`, sin contraseñas ni hashes.

PATCH /me admite cambios parciales, pero valida el nombre resultante completo.
Solo usa el identificador autenticado; rechaza rol, nombre, identificadores,
contraseña y cualquier campo extra. Conserva los validadores Mongoose y el
409 por correo duplicado. El perfil se actualiza globalmente al guardar y se
recupera de MongoDB al recargar o iniciar sesión.

El registro público siempre crea clientes. Solo administrador puede usar
PATCH /api/auth/usuarios/:id/vendedor. Esa ruta no acepta cambios de perfil y
exige que la cuenta tenga nombre estructurado válido; si falta, devuelve 409.
El filtro de actualización comprueba también los datos del nombre leídos,
para no habilitar una cuenta cuyos datos hayan cambiado entre consultas.
Solo actualiza rol a vendedor y conserva el resto de los permisos existentes.

## Cuentas anteriores

Las cuentas que solo tienen `nombre` pueden iniciar sesión y conservan su
nombre visible. No se intenta dividirlo ni rellenar campos por inferencia.
Mi perfil muestra «Falta completar tu nombre» con campos estructurados vacíos.
Para guardar, incluso un cambio de correo, la persona debe completar los datos.
Hasta entonces no se puede habilitar una cuenta cliente como vendedora; los
vendedores existentes conservan su rol y pueden iniciar sesión normalmente.
No se ejecutaron migraciones ni conexiones/escrituras en Atlas. No se abrió ni
modificó backend/.env.

## Verificación automática

En PowerShell: desde backend `npm.cmd test`; desde frontend `npm.cmd test` y
`npm.cmd run build`. Las pruebas sustituyen Mongoose y HTTP; el modelo User se
valida también sin conexión. No cargan .env ni equivalen a persistencia real en
Atlas. Cubren registro, guardar, GET /me, nuevo login, nuevo montaje, navegación,
Unicode, nombres múltiples, apellidos compuestos, un apellido, campos faltantes,
contradicciones, límites, errores por campo, duplicados, cuentas anteriores,
campos protegidos y habilitación exclusiva por administrador.

Resultados: backend 35/35; frontend 24/24 en cuatro archivos. Compilación aprobada
con aviso de bundle mayor a 500 kB. La aceptación visual y persistencia real en
la base de pruebas quedan pendientes de la comprobación manual siguiente.

## Prueba manual: cuenta nueva

Usar exclusivamente la base de pruebas con la configuración ya preparada.

1. Ejecutar `npm.cmd start` en backend y `npm.cmd run dev` en frontend.
2. Abrir registro. Probar Nombre(s) «María José», Primer apellido «De la Cruz» y
   Segundo apellido «Muñoz», con espacios repetidos y en extremos. Crear la
   cuenta: debe ser cliente y mostrar «María José De la Cruz Muñoz».
3. En Mi cuenta, comprobar los campos por separado. Guardar otros nombres y
   correo. Recargar, salir y entrar con el correo nuevo y contraseña habitual.
   Confirmar en Atlas los campos y `nombre` derivado.
4. Probar un nombre sencillo, apellidos con acentos, guiones y apóstrofos.
   Para una cuenta con un apellido: Segundo apellido vacío y «No tengo segundo
   apellido» marcado; guardar y verificar la marca tras recargar.
5. Probar nombre vacío, primer apellido vacío, segundo apellido vacío sin marca,
   números, símbolos y más de 80 caracteres. Verificar error junto al campo,
   sin perder texto. Escribir segundo apellido y marcar que no lo tiene:
   debe rechazarlo sin enviar. Desmarcar y corregir.
6. Probar correo inválido y correo de otra cuenta: error junto al correo, sin
   alterar los datos guardados. Bloquear PATCH /api/auth/me en DevTools:
   mostrar error, conservar formulario y permitir reintentar al desbloquear.
7. Desde una herramienta HTTP privada, comprobar que registro con rol vendedor
   devuelve 403; PATCH /me con nombre, rol o ID ajeno devuelve 400 y sin token,
   401. Confirmar que la respuesta nunca contiene hashes.
8. Como administrador, habilitar la cuenta completa por la ruta existente.
   No deben cambiar sus nombres. Como cliente/vendedor, la misma ruta debe
   devolver 403. Entrar como vendedor y verificar Mi perfil, nombre en panel,
   regreso a tienda y funcionamiento previo del inventario/categorías/libros.

## Prueba manual: cuenta existente sin campos separados

1. Usar una cuenta anterior ya existente en la base de pruebas, sin modificar
   documentos para fabricar el caso. Entrar: debe conservar nombre y rol.
2. Abrir Mi perfil desde tienda o panel. Comprobar el aviso de nombre incompleto,
   el nombre anterior visible y los campos nuevos vacíos, sin división automática.
3. Intentar guardar solo correo: debe exigir los campos del nombre y no escribir.
   Para un cliente anterior, pedir al administrador habilitarlo: esperar 409 sin
   modificar nombre ni rol. La ruta de habilitación no acepta completar nombres.
4. Completar manualmente nombres y apellidos (o marcar la excepción con segundo
   apellido vacío), guardar y comprobar confirmación, nombre visible y correo.
5. Recargar tienda/panel, cerrar sesión y entrar nuevamente: conservar campos,
   marca, nombre completo y rol. Revisar exclusivamente ese documento en Atlas.
6. Para un cliente ya completado, repetir habilitación como administrador: ahora
   debe permitirla sin alterar el nombre. No realizar migraciones masivas.

## Preparar una cuenta administradora de prueba

Usa una base local desechable y separada, como `progwebii_demo_admin`, con el
backend apuntando a ella mediante `MONGO_URI` del proceso. Crea desde la tienda
dos cuentas con correos distintos y contraseñas que elijas para la demo. Una es
la administradora de prueba y la otra es el comprador que se va a habilitar.

Desde `backend`, en una terminal de PowerShell dedicada a la demo:

```powershell
$env:MONGO_URI = 'mongodb://127.0.0.1:27017/progwebii_demo_admin'
$env:JWT_SECRET = node -p "require('node:crypto').randomBytes(48).toString('hex')"
npm.cmd start
```

Desde `frontend`, inicia la tienda con `npm.cmd run dev`. Usa el backend local
para registrar ambas cuentas.

Si todavía no existe un administrador en esa base, una persona con acceso
autorizado a la base local puede abrir `mongosh` desde PowerShell:

```powershell
mongosh 'mongodb://127.0.0.1:27017/progwebii_demo_admin'
```

Comprueba en `mongosh` el nombre de la base y localiza la cuenta que has
reservado para administrar. Reemplaza el correo ilustrativo por el de esa
cuenta local:

```javascript
db.getName()
const correo = 'administracion-demo@example.invalid'
db.users.findOne({ email: correo }, { _id: 1, nombre: 1, email: 1, rol: 1 })
```

Solo si la base es `progwebii_demo_admin` y el registro devuelto es la cuenta
separada esperada con rol `cliente`, copia su identificador y ejecuta:

```javascript
db.users.updateOne(
  { _id: ObjectId('<ID_VERIFICADO>'), email: correo, rol: 'cliente' },
  { $set: { rol: 'administrador' } }
)
```

Comprueba que `matchedCount` y `modifiedCount` sean 1. Usa esa cuenta para
seguir el [recorrido de demostración](MANUAL-USUARIO.md#demostración-de-habilitación-de-vendedores).

## Funciones adicionales del vendedor

No se encontró un documento de propuesta del equipo en este repositorio; esta
lista describe únicamente el código disponible.

| Función | Estado | Dependencias pendientes |
| --- | --- | --- |
| Catálogo, inventario propio y CRUD de libros | Implementados | Ninguna nueva para perfil |
| Crear categorías | Implementado; edición/borrado reservados a administrador | Ninguna nueva |
| Consultar/editar perfil propio | Implementado en esta rama | Aceptación manual en Atlas |
| Ventas e historial del vendedor | Sin rutas ni interfaz | Pedidos/compras persistentes y relación con vendedor |
| Reportes de ventas e ingresos | Sin rutas ni interfaz | Ventas reales, estados y agregaciones por vendedor |
| Pedidos y seguimiento | Existe modelo Order; sin rutas montadas | Flujo de compras/pedidos |

Carrito, compras e historial de la tienda son estado local de React; la compra
actual es una simulación. Existen modelos Cart y Favorite sin rutas montadas.
No se implementaron ni ampliaron estos flujos, pedidos ni pagos.

