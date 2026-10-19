# Análisis — Anatomía de nuestra API

**Grupo:** Nicolás Galvis
**Proyecto:** API de Numerología (Express 5 + Mongoose 9 + express-validator 7)
**Fecha:** 19 de octubre de 2026

> **Cómo se hicieron las pruebas.** Cada experimento se hizo sobre una copia del código, con el cambio temporal aplicado, y después se devolvió el archivo a como estaba. Todo lo que se pega aquí (respuestas HTTP y salidas de consola) está completo en `laboratorio/evidencias/`, un archivo por reto; cada archivo empieza con el `diff` exacto del cambio temporal que se hizo. Para ver las consultas de Mongoose se usa `MONGOOSE_DEBUG=true` en el `.env` (ver `src/DataBase/cnxmongo.js`, líneas 5-7).
>
> Entorno: Node 22.22, Express 5.2.1, Mongoose 9.9, base compatible con MongoDB (FerretDB 1.24). Datos cargados con `npm run seed`.
>
> ✍️ **Nota para Nicolás:** las **predicciones** son la parte que el instructor va a leer como suya. Antes de entregar, léelas, corre tú mismo cada experimento (los comandos están en cada reto) y deja la predicción con tus palabras. Si tu predicción hubiera sido otra, escríbela así: una predicción fallida y explicada vale más.

---

## Bloque 1 — El viaje de una petición

### Reto 1.1 — El mapa

Petición elegida: **`GET /api/v1/numerology-profiles/:id`** (trae un perfil con su usuario poblado).

| # | Parada | Archivo / dueño | Qué hace | Qué le entrega a la siguiente |
|:-:|:--|:--|:--|:--|
| 1 | Postman | (cliente) | Arma la petición HTTP `GET /api/v1/numerology-profiles/6ad6…c4f6f` y la manda por TCP al puerto 3000. | Bytes de una petición HTTP. |
| 2 | Servidor HTTP de Node | **Node** (`http.Server`, creado por `app.listen` en `index.js`, línea 36) | Acepta la conexión TCP, interpreta el texto HTTP y crea los objetos `req` y `res`. | `req` y `res` a la aplicación de Express. |
| 3 | `express.json()` | **Express** (body-parser), montado en `index.js`, línea 19 | Mira el `Content-Type`; como un GET no trae body JSON, no hace nada y llama a `next()`. | El mismo `req` (sin `req.body`). |
| 4 | Prefijo de la colección | **Express**, `index.js`, línea 22: `app.use("/api/v1/numerology-profiles", NumerologyProfilesRoutes)` | Compara la URL con el prefijo; coincide, le quita el prefijo y le pasa el resto (`/6ad6…`) al router. | `req` con `req.url = "/6ad6…"`. |
| 5 | Ruta | `src/routers/NumerologyProfiles.js`, línea 20: `router.get("/:id", idValidator, validarCampos, obtenerNumerologyProfile)` | Compara método y patrón; `/:id` coincide y llena `req.params.id`. Define la lista de funciones que se ejecutan en orden. | `req.params.id = "6ad6…"` al primer middleware. |
| 6 | Validator | `src/validators/NumerologyProfiles.js`, líneas 68-70 (`idValidator`) | Revisa con `isMongoId` que el id tenga forma de ObjectId. **No responde**: deja el resultado guardado dentro de `req`. | `req` con el resultado de la validación. |
| 7 | `validarCampos` | `src/middlewares/validarCampos.js`, líneas 6-20 | Lee los resultados con `validationResult(req)`. No hay errores → `next()` (línea 19). | Pasa al controller. |
| 8 | Controller | `src/controllers/NumerologyProfiles.js`, línea 16 → `getOne` de `src/utils/crudFactory.js`, líneas 40-50 | Llama `NumerologyProfile.findById(req.params.id).populate(POBLAR)`. | Una consulta de Mongoose. |
| 9 | Mongoose (consulta) | **Mongoose** (`node_modules/mongoose`) | Convierte el texto del id en `ObjectId`, arma el comando y lo manda por el driver. | `numerologyprofiles.findOne({ _id: ObjectId(…) })` a MongoDB. |
| 10 | MongoDB | **MongoDB** | Busca el documento por `_id` y lo devuelve. | El documento con `usuario_id` como `ObjectId`. |
| 11 | Mongoose (populate) | **Mongoose** | Junta los `usuario_id` de lo que encontró y hace **otra** consulta: `users.find({ _id: { $in: [...] } }, { projection: { nombre_completo: 1, email: 1 } })`. MongoDB responde y Mongoose reemplaza, **en memoria**, el ObjectId por el documento del usuario. | Un documento de Mongoose ya poblado. |
| 12 | Controller (respuesta) | `src/utils/crudFactory.js`, líneas 44-48 | Como el documento existe, hace `res.status(200).json(documento)`. | Un objeto JS a Express. |
| 13 | Express (`res.json`) | **Express** | Llama `JSON.stringify` (que usa `toJSON` del documento; en el usuario poblado se ejecuta el `transform` de `src/models/Users.js`, líneas 54-59), pone `Content-Type: application/json` y escribe la respuesta. | Bytes HTTP al servidor de Node. |
| 14 | Node → Postman | **Node** | Manda la respuesta por la misma conexión TCP. Postman la muestra. | — |

### Reto 1.2 — El mismo viaje, pero fallando (`/api/v1/numerology-profiles/123abc`)

| # | Parada | ¿Llega? | Qué pasa |
|:-:|:--|:-:|:--|
| 1-5 | Postman → Node → `express.json()` → prefijo → ruta | Sí | Igual que antes; `req.params.id = "123abc"`. |
| 6 | `idValidator` | Sí | `isMongoId` falla y guarda el error "El id proporcionado no es un ObjectId válido de MongoDB". No corta nada todavía. |
| 7 | `validarCampos` | Sí | Encuentra el error y **responde aquí**: `return res.status(400).json(...)` (líneas 9-16). No llama a `next()`. |
| 8-11 | Controller, Mongoose, MongoDB | **No** | Nunca se ejecutan. |
| 13-14 | Express → Postman | Sí | Llega el 400. |

**Dónde se separan los caminos:** en la parada 7, `src/middlewares/validarCampos.js`, línea 9 (`if (!errores.isEmpty())`). El error **se detecta** en la parada 6, pero la **decisión** de cortar la petición se toma en la 7. La petición inválida no llega ni al controller ni a MongoDB.

### Reto 1.3 — Comprobación con `console.log`

Se puso un `console.log("llegué a …")` al inicio de cada parada nuestra (router, validator, `validarCampos`, controller) y se activó `MONGOOSE_DEBUG=true` para ver también las paradas de Mongoose → MongoDB.

Petición válida (`laboratorio/evidencias/1.3-valido.txt`):
```
HTTP/1.1 200 OK
{"_id":"6ad60bc04061a1e0474c4f6f","usuario_id":{"_id":"6ad60bc04061a1e0474c4f6c","nombre_completo":"Bruno Díaz","email":"bruno@test.com"},"numero_vida":4, …}

--- consola del servidor ---
llegué a la ruta (routers/NumerologyProfiles.js)
llegué al validator idValidator (validators/NumerologyProfiles.js)
llegué al middleware validarCampos (middlewares/validarCampos.js)
llegué al controller getOne (utils/crudFactory.js)
Mongoose: numerologyprofiles.findOne({ _id: ObjectId("6ad60bc04061a1e0474c4f6f") }, {})
Mongoose: users.find({ _id: { '$in': [ ObjectId("6ad60bc04061a1e0474c4f6c") ] } }, { projection: { nombre_completo: 1, email: 1 } })
```

Petición con `123abc` (`laboratorio/evidencias/1.3-invalido.txt`):
```
HTTP/1.1 400 Bad Request
{"mensaje":"Error de validación","errores":[{"campo":"id","mensaje":"El id proporcionado no es un ObjectId válido de MongoDB"}]}

--- consola del servidor ---
llegué a la ruta (routers/NumerologyProfiles.js)
llegué al validator idValidator (validators/NumerologyProfiles.js)
llegué al middleware validarCampos (middlewares/validarCampos.js)
```

**¿Confirma la predicción?** El orden de nuestras paradas, sí: en la petición inválida la consola se detiene en `validarCampos` y no aparece ninguna línea `Mongoose:`, o sea, no hubo ni una consulta a la base. **La sorpresa** fue en la petición válida: esperábamos **un** viaje a la base de datos y hubo **dos** (`findOne` del perfil y `find` de los usuarios). El `populate` no es parte de la primera consulta: es una segunda consulta aparte (ver reto 5.2).

---

## Bloque 2 — ¿Quién es responsable de qué?

### Reto 2.1 — Tabla de responsabilidades

| # | Situación | Archivo que lo resuelve | Fragmento |
|:-:|:--|:--|:--|
| 1 | Un campo es obligatorio en la base de datos | `src/models/NumerologyProfiles.js`, línea 8 | `required: [true, "El usuario_id es obligatorio"],` |
| 2 | Se rechaza una petición porque falta un campo, antes de tocar la base | `src/validators/NumerologyProfiles.js`, línea 7 (la regla) + `src/middlewares/validarCampos.js`, líneas 9-16 (el rechazo) | `notEmpty: { errorMessage: "El usuario_id es obligatorio", bail: true },` |
| 3 | `POST /usuarios` ejecuta `crearUsuario` y no otra | `src/routers/Users.js`, línea 22 | `router.post("/", crearUserValidator, validarCampos, crearUsuario);` |
| 4 | Se lee el JSON del body | `index.js`, línea 19 | `app.use(express.json());` |
| 5 | Código HTTP cuando todo sale bien | `src/utils/crudFactory.js`, línea 48 (GET), 60 (POST) | `res.status(200).json(documento);` / `res.status(201).json(documento);` |
| 6 | Código HTTP cuando el documento no existe | `src/utils/crudFactory.js`, líneas 44-46 | `if (!documento) { return res.status(404).json({ mensaje: mensajeNoEncontrado }); }` |
| 7 | Se establece la conexión con MongoDB | `src/DataBase/cnxmongo.js`, línea 15 (y se llama en `index.js`, línea 34) | `await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });` |
| 8 | Un campo apunta a otra colección | `src/models/NumerologyProfiles.js`, líneas 6-7 | `type: mongoose.Schema.Types.ObjectId,` `ref: "User",` |
| 9 | Se reemplaza un ObjectId por el documento al que apunta | `src/utils/crudFactory.js`, línea 42, con la configuración de `src/controllers/NumerologyProfiles.js`, línea 12 | `await Model.findById(req.params.id).populate(populate ?? []);` / `const POBLAR = { path: "usuario_id", select: "nombre_completo email" };` |
| 10 | Prefijo de URL de cada colección | `index.js`, líneas 21-25 | `app.use("/api/v1/numerology-profiles", NumerologyProfilesRoutes);` |
| 11 | Se impide que el cliente se autoasigne un campo | `src/utils/crudFactory.js`, líneas 19-29 + lista blanca en cada controller (p. ej. `src/controllers/Readings.js`, línea 6) | `for (const campo of campos) { if (body[campo] !== undefined) { payload[campo] = body[campo]; } }` |
| 12 | Se recogen los errores de validación y se arma el 400 | `src/middlewares/validarCampos.js`, líneas 7 y 9-16 | `const errores = validationResult(req);` … `return res.status(400).json({ mensaje: "Error de validación", errores: … })` |

### Reto 2.2 — Lo que no está en ninguna parte

En el código **actual** las 12 filas tienen archivo. Pero en el código **con el que empezamos** (commit `8930c00`) había huecos, y uno sigue abierto:

**Hueco 1 (ya cerrado) — fila 9, populate.** En el código original no había **ningún** `populate` en el repo. *Qué pasaba:* el GET de un perfil devolvía `"usuario_id":"6ad6…"`, un id suelto; el frontend tenía que hacer una segunda petición por cada perfil para saber de quién era. *Dónde debe vivir:* en la consulta, o sea en el controller/fábrica (`crudFactory.js`), porque es una decisión sobre **qué trae la respuesta** de un endpoint, no sobre qué se guarda (el modelo solo declara el `ref`) ni sobre qué entra (el validator).

**Hueco 2 (ya cerrado) — "una referencia apunta a algo que existe".** No es una fila de la tabla, pero es la pregunta que la tabla no hace: la fila 8 dice que el campo *apunta* a otra colección, y nadie revisaba que *exista*. *Qué pasaba:* `POST /numerology-profiles` con `usuario_id: "000000000000000000000001"` → 201. *Dónde debe vivir:* en el validator, con una consulta (`src/validators/reglasComunes.js`, líneas 31-41); la justificación completa está en `laboratorio/defensa-tecnica.md`, pregunta 3.

**Hueco 3 (abierto) — "un PUT trae al menos un campo que se pueda cambiar".** *Qué pasa hoy:* `PUT /readings/:id` con solo campos no permitidos (`{"fecha":"2000-01-01","_id":"111…","es_admin":true}`) responde **200** y lo único que cambia es `updatedAt` (ver reto 3.5). *Dónde debería vivir:* en el **validator** de actualización, como una regla sobre el body completo ("al menos uno de estos campos"), porque es una regla sobre la entrada y debe responder 400 antes de llegar a la base. No en el controller: sería meter una validación de formato en la capa que no le toca (reto 2.3).

### Reto 2.3 — Lógica en el lugar equivocado

**Criterio con el que revisamos:** buscamos en `src/controllers/` y `src/utils/crudFactory.js` (1) cualquier `if` que revise el formato o la presencia de un dato de entrada, (2) bloques iguales repetidos en varios archivos, y (3) cualquier cosa que decida un código HTTP de error que no sea "no existe".

**Lo que encontramos en el código original:** el mismo bloque repetido **seis veces** (cinco en `crudFactory.js` y otra vez en cada función de `controllers/Users.js`):
```js
        } catch (error) {
            res.status(400).json({ mensaje: mensajeError, error: error.message });
        }
```
Eso es **manejo de errores**, y pertenece a un middleware de errores, no al controller. Además, al estar repetido, cada copia decidía distinto: unas respondían 400 y otras 500 para el mismo tipo de error. Se movió a `src/middlewares/manejoErrores.js` y se quitaron los `try/catch` (en Express 5 los errores de funciones `async` llegan solos al middleware de errores).

**Lo que queda en los controllers hoy y por qué está bien ahí:**
- `if (password_hash) { cambios.password_hash = hashearPassword(password_hash); }` (`src/controllers/Users.js`, líneas 58-60): no valida nada, decide **qué hacer** con un dato ya validado (hashearlo solo si vino). Es lógica de negocio.
- `if (!credencialesValidas) { return res.status(401)… }` (`src/controllers/Users.js`, login): comparar la contraseña con el hash requiere consultar la base; no es una regla de formato.
- `if (!documento) { return res.status(404)… }`: saber si existe requiere consultar la base. Es del controller.

No encontramos validaciones de formato en los controllers: todas están en `src/validators/`.

---

## Bloque 3 — Autopsia de respuestas

### Reto 3.1 — `HTTP 500 {"mensaje":"Error al obtener la matriz","error":"Cast to ObjectId failed …"}`

- **¿Quién generó el texto?** Hay dos autores. `"Error al obtener la matriz"` lo escribió el programador (es el `mensajeError` que se le pasa al controller). `"Cast to ObjectId failed for value \"123abc\" … for model \"MatrizNumerologica\""` lo generó **Mongoose** (es el mensaje de un `CastError`, cuando intenta convertir `"123abc"` en ObjectId para hacer la consulta). Y fue el **programador** quien decidió mostrarlo, al poner `error: error.message` en el `catch`.
- **¿500 es correcto?** No. 500 significa "falló el servidor". Aquí el que se equivocó fue el cliente al mandar un id mal formado: corresponde **400 Bad Request**. (No 404: no es que el recurso no exista, es que la petición ni siquiera es válida.)
- **¿Qué problema hay en mostrarlo?** Le cuenta al que consume la API detalles internos: que usamos Mongoose, el nombre interno del modelo (`MatrizNumerologica`) y del campo (`_id`). Es información útil para un atacante y no le sirve de nada al frontend, que no puede mostrarle ese texto a un usuario.

**Lo reprodujimos en nuestra propia API.** Con el código original, quitando el `idValidator` de `GET /readings/:id` (`laboratorio/evidencias/3.1-original-sin-idvalidator.txt`):
```
HTTP/1.1 500 Internal Server Error
{"mensaje":"Error al obtener lectura","error":"Cast to ObjectId failed for value \"123abc\" (type string) at path \"_id\" for model \"Reading\""}
```
Es exactamente la misma respuesta de la guía. Con el código actual y la misma prueba (sin `idValidator`), el `CastError` llega al manejador de errores (`src/middlewares/manejoErrores.js`, líneas 50-55) y sale así (`evidencias/3.1-final-sin-idvalidator.txt`):
```
{"mensaje":"Error de validación","errores":[{"campo":"_id","mensaje":"Valor inválido para _id"}]}   (HTTP 400)
```
Y con el `idValidator` puesto, la petición ni siquiera llega a Mongoose (reto 1.2).

### Reto 3.2 — `HTTP 200 null`

- **¿Dónde nace?** En el controller. `findById` devuelve `null` cuando el id tiene buen formato pero no existe; si el controller hace `res.status(200).json(documento)` sin revisar, Express convierte `null` en el texto `null` y lo manda con 200.
- **¿Qué tendría que haber pasado?** Revisar el resultado antes de responder, como en `src/utils/crudFactory.js`, líneas 44-46:
  ```js
        if (!documento) {
            return res.status(404).json({ mensaje: mensajeNoEncontrado });
        }
  ```
- **Lo comprobamos** quitando ese `if` (`evidencias/3.2-sin-if-404.txt`):
  ```
  $ curl localhost:3000/api/v1/readings/000000000000000000000000
  null
  (HTTP 200)
  Mongoose: readings.findOne({ _id: ObjectId("000000000000000000000000") }, {})
  ```
  La consulta sí se hizo; simplemente no encontró nada y nadie lo revisó.
- **Problema para el frontend:** un 200 significa "todo bien", así que el código del frontend va directo a usar los datos (`datos.prompt`) y se cae con `TypeError: Cannot read properties of null`. No tiene manera de distinguir "no existe" de "hubo un error", y no hay mensaje que mostrar.

### Reto 3.3 — `HTTP 400 {"mensaje":"Error de validación","errores":[{"campo":"fecha_debut",…}]}`

El equivalente en nuestra API es el de `fecha_nacimiento`, que obtuvimos en el ataque #3 (`laboratorio/pruebas/ronda1-codigo-original.md`):
```
POST /api/v1/users  {"nombre_completo":"Fecha Mala", …, "fecha_nacimiento":"ayer"}
-> 400 {"mensaje":"Error de validación","errores":[{"campo":"fecha_nacimiento","mensaje":"La fecha de nacimiento debe ser una fecha válida (YYYY-MM-DD)"}]}
```
Recorrido del mensaje, en tres lugares:

1. **Dónde nace el texto:** `src/validators/Users.js`, línea 14, en la regla `isISO8601` de `reglaFechaNacimiento`, que se asigna al campo en la línea 51 (`fecha_nacimiento: reglaFechaNacimiento,`).
   ```js
   isISO8601: { errorMessage: "La fecha de nacimiento debe ser una fecha válida (YYYY-MM-DD)", bail: true },
   ```
   Cuando la regla falla, express-validator guarda el error **dentro de `req`** (no responde nada).
2. **Dónde se recoge:** `src/middlewares/validarCampos.js`, línea 7: `const errores = validationResult(req);`
3. **Dónde se convierte en respuesta HTTP:** `src/middlewares/validarCampos.js`, líneas 10-16: `return res.status(400).json({ mensaje: "Error de validación", errores: errores.array().map((err) => ({ campo: err.path, mensaje: err.msg })) });` — ahí `err.path` se vuelve `"campo"` y `err.msg` se vuelve `"mensaje"`.

### Reto 3.4 — `HTTP 404 Cannot POST /api/v1/usuarios/registro` (en HTML)

- **¿Quién la generó?** **Express**, con su manejador final por defecto (el paquete `finalhandler`). Cuando una petición recorre toda la lista de middlewares y rutas y nadie responde, Express contesta ese 404.
- **¿Por qué no es JSON?** Porque no la escribimos nosotros: Express no sabe que nuestra API habla JSON y usa su formato por defecto, una página HTML con `<pre>Cannot POST …</pre>`.
- **Nos pasaba igual** (ataque #11, ronda 1):
  ```
  POST /api/v1/users/registro -> 404 <!DOCTYPE html> … <pre>Cannot POST /api/v1/users/registro</pre> …
  ```
- **Qué hicimos para que no vuelva a pasar:** un middleware "atrapa-todo" **después** de todas las rutas (`src/middlewares/manejoErrores.js`, líneas 6-10, montado en `index.js`, línea 28):
  ```js
  export const rutaNoEncontrada = (req, res) => {
    res.status(404).json({
      mensaje: `La ruta ${req.method} ${req.originalUrl} no existe`,
    });
  };
  ```
  Ahora: `POST /api/v1/users/registro -> 404 {"mensaje":"La ruta POST /api/v1/users/registro no existe"}`. Tiene que ir después de las rutas: si fuera antes, respondería 404 a todo.

### Reto 3.5 — Una respuesta mal hecha de nuestra API

Provocamos esta (`evidencias/3.5-put-solo-campos-prohibidos.txt`):
```
$ curl -X PUT localhost:3000/api/v1/readings/6ad60d315d6e27fa6730d856 -d '{"fecha":"2000-01-01","_id":"111111111111111111111111","es_admin":true}'
{"_id":"6ad60d315d6e27fa6730d856","prompt":"¿Cómo va mi vida amorosa?", … ,"updatedAt":"2026-10-19T12:29:50.861Z","__v":0}
(HTTP 200)

Mongoose: readings.findOneAndUpdate({ _id: ObjectId("6ad60d315d6e27fa6730d856") }, { '$set': { updatedAt: new Date("Mon, 19 Oct 2026 12:29:50 GMT") } }, …)
```
**Qué está mal:** el cliente mandó tres campos que no se pueden cambiar y la API respondió **200 OK** como si hubiera actualizado algo. La consola muestra que la única "actualización" fue `updatedAt`: se toca la base de datos para nada y se cambia la fecha de modificación de un documento que nadie modificó. El cliente cree que su cambio se guardó. Lo correcto sería **400** con un mensaje tipo "No se envió ningún campo que se pueda actualizar". No es un hueco de seguridad (la lista blanca funcionó y no se guardó nada indebido), pero la respuesta miente. Queda como pendiente (Bloque 2, hueco 3).

---

## Bloque 4 — Qué hace realmente el servidor

### Reto 4.1 — `express.json()`

**Predicción (antes de ejecutar):** al comentar la línea, `req.body` va a quedar `undefined`. Creemos que el controller de usuarios va a reventar con un 500 al hacer `const { nombre_completo, … } = req.body` (no se puede desestructurar `undefined`).

**Resultado** (`evidencias/4.1-sin-express-json.txt`, con `index.js` línea 19 comentada):
```
$ curl -X POST localhost:3000/api/v1/users -H "Content-Type: application/json" -d '{"nombre_completo":"Prueba Json","email":"json@test.com","password_hash":"secreto123","fecha_nacimiento":"2000-02-02"}'
{"mensaje":"Error de validación","errores":[{"campo":"nombre_completo","mensaje":"El nombre completo es obligatorio"},{"campo":"email","mensaje":"El email es obligatorio"},{"campo":"password_hash","mensaje":"La contraseña es obligatoria"},{"campo":"fecha_nacimiento","mensaje":"La fecha de nacimiento es obligatoria"}]}
(HTTP 400)
```
**Consola del servidor:** nada aparte del arranque. Ningún error. Agregando un `console.log("req.body =", req.body)` en `validarCampos` (`evidencias/4.1b-req-body.txt`):
```
req.body = undefined
```
Con la línea en su sitio, la misma petición da 201 y crea el usuario (`evidencias/4.1-control-normal.txt`).

**¿Acertamos?** A medias. `req.body` sí quedó `undefined`, pero **no** hubo 500: la petición nunca llegó al controller. El validator corre antes y, al buscar `nombre_completo` dentro de un body que no existe, lo trata como "no vino". Así que la API dice "todos los campos son obligatorios" aunque el cliente los mandó todos: un mensaje que confunde mucho si uno no sabe que falta el parser.

**¿Qué hace exactamente esa línea?** `express.json()` es un middleware que, en cada petición cuyo `Content-Type` sea `application/json`, **lee el cuerpo de la petición** (que llega como un stream de bytes por la conexión, no viene "listo"), lo convierte a texto, le aplica `JSON.parse` y **deja el objeto resultante en `req.body`**. Si el JSON está mal escrito, en vez de llenar `req.body` llama a `next(error)` con un error de tipo `entity.parse.failed` (reto 4.4). Sin esa línea nadie lee el cuerpo y `req.body` no existe.

### Reto 4.2 — El orden sí importa

**Predicción:** si `express.json()` va después de las rutas, va a pasar lo mismo que en 4.1, porque cuando el parser llegue a ejecutarse la ruta ya habrá respondido.

**Resultado** (`evidencias/4.2-express-json-despues.txt`): idéntico a 4.1, 400 con "todos los campos son obligatorios".

**¿Por qué?** Express guarda los `app.use` y `app.get/post…` en **una sola lista, en el orden en que se registran**, y cada petición recorre esa lista de arriba hacia abajo. Con el cambio, el orden quedó:
1. `app.use("/api/v1/users", UsersRoutes)` …
2. … resto de rutas …
3. `app.use(express.json())`
4. `rutaNoEncontrada`, `manejadorErrores`

El `POST /api/v1/users` entra en el paso 1: el router ejecuta `crearUserValidator` → `validarCampos`, que **responde** el 400 y no llama a `next()`. La petición termina ahí. El paso 3 nunca se ejecuta para esa petición; solo lo alcanzarían las peticiones que ninguna ruta respondió (y esas terminan en el 404). El parser tiene que estar antes porque tiene que **preparar** `req.body` antes de que alguien lo lea.

(La línea se devolvió a su sitio: `index.js`, línea 19.)

### Reto 4.3 — `next()`

**Predicción:** sin `next()`, las peticiones válidas se van a quedar colgadas (nadie responde); las inválidas van a seguir dando 400.

**Resultado** (`evidencias/4.3-sin-next.txt`, línea 19 de `validarCampos.js` comentada):
```
$ curl -m 10 localhost:3000/api/v1/readings/6ad60bc04061a1e0474c4f75   (id válido)
(HTTP 000)
real  0m10.011s
exit curl=28                         <- curl se rindió a los 10 s: timeout

$ curl -m 10 localhost:3000/api/v1/readings/123abc   (id inválido)
{"mensaje":"Error de validación", … }
(HTTP 400)

$ curl -m 10 localhost:3000/api/v1/readings   (ruta sin validarCampos)
(HTTP 200)
```
Y en la consola no aparece ninguna consulta para el id válido: nunca se llegó al controller.

**Explicación:** un middleware tiene tres opciones: responder, llamar a `next()` para pasarle el turno al siguiente, o no hacer ninguna de las dos. Sin `next()`, cuando no hay errores `validarCampos` no hace **nada**: no responde y no le pasa el turno a nadie. La conexión queda abierta esperando una respuesta que nunca llega. Las rutas sin `validarCampos` (como el listado) no se enteran.

**¿Por qué `next()` está fuera del `if`?** Porque el `if` es el camino del error y termina con `return`. Todo lo que está después del `if` es, en la práctica, el "si no hubo errores". Si `next()` estuviera **dentro** del `if`, se llamaría justo cuando hay errores: la petición inválida seguiría al controller con datos malos, y además el controller intentaría responder por segunda vez (`Cannot set headers after they are sent to the client`).

**¿Por qué en el error se usa `return res.status(400)…` y no `next()`?** Porque en ese camino la petición **debe terminar ahí**: el 400 es la respuesta final. `next()` significaría "sigue al controller", que es justo lo que no queremos. El `return` sirve para que la función se salga y no siga a la línea 19; sin él, después de responder el 400 se ejecutaría también el `next()`.

### Reto 4.4 — El middleware de cuatro parámetros

`src/middlewares/manejoErrores.js`, línea 21: `export const manejadorErrores = (err, req, res, next) => {`

- **¿Por qué cuatro parámetros?** Porque así es como Express distingue un manejador de errores de un middleware normal: mira cuántos parámetros declara la función (`función.length`). Si son 4, es de errores, y Express solo lo ejecuta cuando hay un error (alguien llamó `next(error)` o una función `async` lanzó una excepción); en el camino normal se lo salta. Si son 3, es un middleware normal, y en el camino de error se lo salta.
- **¿Qué pasa si le quitamos el `next`?** Lo probamos (`evidencias/4.4b-manejador-con-3-parametros.txt`). Con JSON roto en el body:
  ```
  <!DOCTYPE html>
  <html lang="en"> … <pre>SyntaxError: Expected double-quoted property name in JSON at position 20 (line 1 column 21)<br> &nbsp; &nbsp;at JSON.parse (&lt;anonymous&gt;)<br> &nbsp; &nbsp;at parse (./node_modules/body-parser/lib/types/json.js:91:21)<br> …</pre> …
  (HTTP 400)
  ```
  Express dejó de reconocerlo como manejador de errores, nadie atrapó el error y respondió el manejador por defecto de Express: **HTML con el stack trace completo** y las rutas de los archivos del servidor. Aunque el `next` no se use dentro de la función, tiene que estar declarado.
- **¿Por qué al final?** Cuando ocurre un error, Express busca el **siguiente** manejador de errores **hacia adelante** en la lista, desde el punto donde ocurrió. Si estuviera al principio, los errores de las rutas (que están después) nunca lo encontrarían. Al final, todo lo que está antes puede caer en él.
- **Un error que sí llega** (`evidencias/4.4-json-roto-llega-al-manejador.txt`):
  ```
  $ curl -X POST localhost:3000/api/v1/users -H 'Content-Type: application/json' -d '{"email": "a@b.com",'
  {"mensaje":"El cuerpo de la petición no es un JSON válido"}
  (HTTP 400)
  ```
  El error lo lanza `express.json()` y cae en las líneas 23-25 del manejador. Otro ejemplo, un error inesperado lanzado dentro de un controller `async` (el del reto 5.3, `MissingSchemaError`): llega al final del manejador (líneas 59-60), se imprime completo en la consola y el cliente solo recibe `500 {"mensaje":"Error interno del servidor"}`.

### Reto 4.5 — El orden de las rutas

**Predicción:** con `/:id` primero, `GET /readings/activos` lo va a atrapar `/:id` con `id = "activos"`, y como tenemos `idValidator`, va a responder 400 "no es un ObjectId válido". `listarActivos` nunca se ejecuta.

**Resultado** (`evidencias/4.5a-activos-despues.txt`), con las dos rutas en el orden de la guía:
```
$ curl localhost:3000/api/v1/readings/activos
{"mensaje":"Error de validación","errores":[{"campo":"id","mensaje":"El id proporcionado no es un ObjectId válido de MongoDB"}]}
(HTTP 400)
```
Con el orden al revés (`evidencias/4.5b-activos-antes.txt`):
```
$ curl localhost:3000/api/v1/readings/activos
{"mensaje":"llegué a listarActivos"}
(HTTP 200)
```
**Explicación:** el router revisa las rutas en el orden en que se declararon y usa la **primera** que coincida. `/:id` coincide con **cualquier** segmento, incluida la palabra `activos`. **Orden correcto:** primero las rutas fijas (`/activos`, `/estadisticas`), después las que tienen parámetros (`/:id`). Sin el `idValidator` el error sería peor: `findById("activos")` daría un `CastError`.

### Reto 4.6 — `app.listen`

- **¿Qué hace?** `app.listen(PORT, callback)` (`index.js`, línea 36) crea un servidor HTTP de Node (`http.createServer(app)`) y le pide al sistema operativo que le **reserve el puerto 3000**: a partir de ahí, toda conexión TCP que llegue a ese puerto se le entrega a este proceso, y Node se la pasa a `app` (la aplicación de Express) como `req`/`res`.
- **¿Por qué el programa no termina?** Node termina cuando no le queda nada pendiente en el *event loop*. Un servidor escuchando es algo pendiente permanente (un socket abierto esperando conexiones), así que el proceso se queda vivo esperando eventos. La conexión a MongoDB también mantiene sockets abiertos.
- **¿Qué significa "escuchando"?** Que el proceso tiene un socket asociado a un puerto y el sistema operativo le entrega ahí las conexiones entrantes. Es un buzón con número: si el número ya lo tiene otro proceso, no se puede abrir.

  Esto lo comprobamos y encontramos algo (`evidencias/4.6-puerto-ocupado.txt`). Con el código **original**, arrancando un segundo servidor cuando el puerto ya estaba ocupado:
  ```
  Conexión exitosa a MongoDB
  Servidor corriendo en http://localhost:3000
  (el proceso NO terminó: seguía vivo sin estar escuchando el puerto)
  ```
  ¡Decía "corriendo" sin estar escuchando! En **Express 5**, si `listen` falla, el error se le pasa como parámetro al callback, y el callback original no lo revisaba. El proceso seguía vivo por la conexión a MongoDB. Con el código actual (`index.js`, líneas 36-44):
  ```
  No se pudo abrir el puerto 3000: listen EADDRINUSE: address already in use 0.0.0.0:3000
  (el proceso terminó con código 1)
  ```
- **¿Qué hacía el túnel de VS Code (Port Forwarding)?** Nuestro servidor **no cambió en nada**: siguió escuchando en `localhost:3000`, que solo es alcanzable desde nuestro computador. Lo que cambió fue **afuera**: VS Code abrió una conexión **saliente** desde nuestro computador hacia un servidor de Microsoft (Dev Tunnels) y obtuvo una URL pública (`https://xxxx-3000.use.devtunnels.ms`). Cuando el compañero hace una petición a esa URL, llega al servidor de Microsoft, viaja por esa conexión ya abierta hasta el agente de VS Code en nuestra máquina, y el agente la reenvía a `localhost:3000` como si fuera una petición local. Por eso al cerrar VS Code se caía el túnel aunque el servidor siguiera corriendo.

---

## Bloque 5 — Las relaciones por dentro

### Reto 5.1 — Qué guarda MongoDB de verdad

`evidencias/5.1-que-guarda-mongo.txt`. En la base (consulta directa con el driver de MongoDB, sin Mongoose):
```
{
  _id: new ObjectId('6ad60bc04061a1e0474c4f6f'),
  usuario_id: new ObjectId('6ad60bc04061a1e0474c4f6c'),
  numero_vida: 4,
  …
}
typeof usuario_id: ObjectId
```
En `GET /api/v1/numerology-profiles/6ad60bc04061a1e0474c4f6f`:
```json
  "usuario_id": {
    "_id": "6ad60bc04061a1e0474c4f6c",
    "nombre_completo": "Bruno Díaz",
    "email": "bruno@test.com"
  },
```
- **En la base** el campo es solo un `ObjectId` (12 bytes): el "número de cédula" del usuario, no el usuario.
- **¿Dónde y cuándo ocurre la transformación?** En **Node**, dentro de Mongoose, en la línea 42 de `src/utils/crudFactory.js` (`.populate(populate ?? [])`). Después de traer el perfil, Mongoose hace una segunda consulta a `users` con ese id y, **en memoria**, cambia el ObjectId por el objeto que encontró. Se ve en la consola:
  ```
  Mongoose: numerologyprofiles.findOne({ _id: ObjectId("6ad60bc04061a1e0474c4f6f") }, {})
  Mongoose: users.find({ _id: { '$in': [ ObjectId("6ad60bc04061a1e0474c4f6c") ] } }, { projection: { nombre_completo: 1, email: 1 } })
  ```
- **¿El populate cambia lo que está guardado?** **No.** Volvimos a leer el documento directamente de la base **después** del GET:
  ```
  usuario_id = new ObjectId('6ad60bc04061a1e0474c4f6c') | updatedAt = 2026-10-19T12:23:28.798Z
  ```
  Sigue siendo un ObjectId y `updatedAt` no cambió. Además, en la consola solo hay `find`/`findOne`: no hubo ninguna operación de escritura. El populate solo cambia la copia que se manda en la respuesta.

### Reto 5.2 — Cuántas veces se consulta la base de datos

Nuestra línea equivalente: `Model.find().populate(populate ?? [])` en `src/utils/crudFactory.js`, línea 35, que para perfiles es `NumerologyProfile.find().populate({ path: "usuario_id", select: "nombre_completo email" })`.

**Predicción:** una consulta para los perfiles y una por cada perfil para su usuario: con 3 perfiles, 4 consultas.

**Resultado** (`evidencias/5.2-cuantas-consultas.txt`), `GET /api/v1/numerology-profiles` con 3 perfiles:
```
Mongoose: numerologyprofiles.find({}, {})
Mongoose: users.find({ _id: { '$in': [ ObjectId("6ad60bc04061a1e0474c4f6c"), ObjectId("6ad60bc04061a1e0474c4f6b"), ObjectId("6ad60bc04061a1e0474c4f6d") ] }}, { projection: { nombre_completo: 1, email: 1 } })
```
**2 consultas, no 4.** La predicción falló: Mongoose **no** hace una consulta por documento. Junta todos los `usuario_id` de los 3 perfiles y hace **una sola** consulta con `$in`. Sean 3 o 3.000 perfiles, son 2 consultas por cada relación poblada.

Lo confirmamos con compatibilidades, que pueblan **dos** campos (`usuario_id_1` y `usuario_id_2`):
```
Mongoose: compatibilitymatches.find({}, {})
Mongoose: users.find({ _id: { '$in': [ ObjectId("…4f6b"), ObjectId("…4f6c") ] }}, …)
Mongoose: users.find({ _id: { '$in': [ ObjectId("…4f6c"), ObjectId("…4f6d") ] }}, …)
```
**3 consultas**: 1 + una por cada `path`. Y algo más: las 3 compatibilidades tienen como `usuario_id_1` a Ana, Bruno y Ana, pero el `$in` solo trae **2** ids: Mongoose quita los repetidos antes de consultar.

- **¿MongoDB hizo un JOIN?** No. MongoDB recibió consultas separadas y cada una devolvió documentos de **una sola** colección. No sabe que están relacionadas.
- **¿Dónde se juntaron los datos?** En **Node**: Mongoose recibió los usuarios y, comparando `_id`, los metió en cada perfil. (MongoDB sí tiene una forma de juntar en la base, `$lookup` dentro de `aggregate`, pero `populate` no la usa.)

### Reto 5.3 — El nombre del `ref`

`ref: "User"` (`src/models/NumerologyProfiles.js`, línea 7) tiene que coincidir **exactamente** con el nombre con el que se registró el modelo, en `src/models/Users.js`, línea 61:
```js
export default model("User", userSchema);
```
No con el nombre del archivo (`Users.js`), ni de la variable, ni de la colección en MongoDB (`users`).

**Predicción:** con `ref: "Users"` el servidor arranca y guarda bien (el `ref` no se usa al guardar), y falla solo al hacer populate.

**Resultado** (`evidencias/5.3-ref-mal-escrito.txt`):
1. **Arranque:** normal ("Servidor corriendo"). Mongoose no revisa que el `ref` exista al definir el schema.
2. **Guardar** (`POST /api/v1/numerology-profiles`): **500** `{"mensaje":"Error interno del servidor"}`… pero en la consola aparece:
   ```
   Mongoose: numerologyprofiles.insertOne({ usuario_id: ObjectId("6ad60bc04061a1e0474c4f6d"), numero_vida: 5, … })
   MissingSchemaError: Schema hasn't been registered for model "Users".
   Use mongoose.model(name, schema)
   ```
   **El documento sí se guardó.** Lo que falló fue el `populate` que nuestro `createOne` hace después de crear (`src/utils/crudFactory.js`, línea 58). El cliente recibió un 500 y probablemente vuelva a intentar, creando un duplicado.
3. **Populate** (`GET /api/v1/numerology-profiles`): **500**, mismo error exacto:
   ```
   MissingSchemaError: Schema hasn't been registered for model "Users".
   Use mongoose.model(name, schema)
   ```

La predicción fue correcta en lo principal (falla en el populate, no al arrancar ni al guardar), pero no habíamos pensado que, como **nuestro POST también hace populate**, el error aparece en el POST con el dato ya guardado. (Se devolvió a `ref: "User"`.)

### Reto 5.4 — Populate anidado

No tenemos ninguno. La consulta que más se beneficiaría es **`GET /api/v1/compatibility-matches/:id`**: hoy trae los dos usuarios con nombre y email, pero una compatibilidad numerológica se calcula con los **números** de cada uno, que están en su perfil numerológico. Con un populate anidado la respuesta podría traer, dentro de cada usuario, su `numero_vida`, `numero_expresion` y `numero_alma`, y el frontend podría mostrar *por qué* son compatibles sin hacer otras dos peticiones.

La dificultad: la relación está "al revés". El perfil apunta al usuario (`usuario_id`), pero el usuario no tiene ningún campo que apunte a su perfil. Por eso habría que declarar primero en el schema de `User` un **virtual** (un campo que no se guarda) que diga "mi perfil es el documento de `NumerologyProfile` cuyo `usuario_id` sea mi `_id`". Con eso, Mongoose haría, paso a paso:
1. Consultar la compatibilidad (`compatibilitymatches.findOne`).
2. Juntar `usuario_id_1` y `usuario_id_2` y consultar los usuarios (`users.find` con `$in`), uno por cada `path`.
3. Con los `_id` de esos usuarios, consultar los perfiles (`numerologyprofiles.find({ usuario_id: { $in: [...] } })`).
4. En memoria: meter cada perfil dentro de su usuario, y cada usuario dentro de la compatibilidad.

Serían 1 + 2 + 2 = 5 consultas, todas con `$in`, y todo el armado en Node.

---

## Bloque 6 — El arranque

### Reto 6.1 — La secuencia

Desde `npm run dev` hasta "listo para recibir peticiones":

1. **npm** lee `package.json`, busca el script `dev` y ejecuta `nodemon index.js`. Nodemon es el que vigila los archivos y reinicia el proceso cuando cambian.
2. **Nodemon** lanza `node index.js`.
3. **Node** lee el `package.json` más cercano, ve `"type": "module"` y trata `index.js` como **módulo ES**.
4. **Node analiza todos los `import`** de `index.js` (y, recursivamente, los de cada archivo importado) **antes de ejecutar una sola línea**. Arma el árbol completo de dependencias.
5. **Node evalúa los módulos en el orden en que aparecen los `import`, de abajo hacia arriba del árbol** (primero las dependencias de cada módulo, luego el módulo):
   - `dotenv/config` (`index.js`, línea 3): lee el `.env` y llena `process.env`. **Va primero** porque `src/DataBase/cnxmongo.js` lee `process.env.MONGOOSE_DEBUG` apenas se evalúa (reto 6.2).
   - `express`.
   - `src/DataBase/cnxmongo.js`: importa Mongoose y, si `MONGOOSE_DEBUG` es `"true"`, activa el modo debug. Solo **define** `conectarDB`; todavía no conecta.
   - Cada router (`src/routers/Users.js`, …): al evaluarse importan sus controllers, que importan los **modelos** (`mongoose.model("User", …)` **registra** cada modelo en Mongoose), los validators y los middlewares. Al final de esta etapa los cinco modelos están registrados.
   - `src/middlewares/manejoErrores.js`.
6. **Cuerpo de `index.js`**, en orden:
   - Línea 14, `const app = express()`: crea la aplicación (una lista vacía de middlewares).
   - Línea 15, `PORT`: ya puede leer `process.env.PORT` porque dotenv ya corrió.
   - Línea 19, `express.json()`: primero de la lista, porque todas las rutas necesitan `req.body` ya listo.
   - Líneas 21-25, las rutas con su prefijo.
   - Línea 28, `rutaNoEncontrada`: después de las rutas, para atrapar solo lo que ninguna respondió.
   - Línea 31, `manejadorErrores`: de último, para que le lleguen los errores de todo lo anterior.
   - Línea 34, `await conectarDB()`: conecta a MongoDB. Es un `await` de nivel superior (se puede porque es módulo ES): el código no sigue hasta que la conexión esté lista o falle.
   - Línea 36, `app.listen(PORT, …)`: abre el puerto. Va **después** de conectar a propósito: así nunca hay un momento en el que la API reciba peticiones sin tener base de datos.
7. El callback de `listen` revisa si hubo error (líneas 39-42) y si no, imprime "Servidor corriendo". Desde aquí el proceso queda esperando conexiones (reto 4.6).

### Reto 6.2 — Por qué dotenv va primero

**Predicción:** moverlo al final de los imports no va a romper nada, porque la URI de Mongo, el `PORT` y la clave del JWT se leen dentro de funciones, que se ejecutan después de que todos los imports ya corrieron.

**Resultado** (`evidencias/6.2-dotenv-al-final.txt`), con `MONGOOSE_DEBUG=true` en el `.env`:
```
$ curl localhost:3000/api/v1/readings
(HTTP 200)

### Consola del servidor
Conexión exitosa a MongoDB
Servidor corriendo en http://localhost:3000
```
Con `dotenv` primero (`evidencias/6.2-control-dotenv-primero.txt`), la misma petición imprime además `Mongoose: readings.find({}, {})`.

**La predicción falló en un detalle:** la API funcionó (conectó, abrió el puerto, respondió 200), pero **el modo debug no se activó**, aunque el `.env` dice `true`. Lo confirmamos imprimiendo la variable en dos momentos (`evidencias/6.2b-orden-de-evaluacion.txt`):
```
evaluando cnxmongo.js -> MONGOOSE_DEBUG = undefined
ejecutando el cuerpo de index.js -> MONGOOSE_DEBUG = true
```
**Explicación:** en un módulo ES, Node **evalúa todos los módulos importados, en el orden en que aparecen los `import`, antes de ejecutar el cuerpo** del archivo que los importa. Con `dotenv/config` al final, `cnxmongo.js` se evaluó **antes** que dotenv, y su línea 5 (`if (process.env.MONGOOSE_DEBUG === "true")`) se ejecutó con la variable todavía vacía. Lo que se lee *dentro de funciones* (`MONGODB_URI` en `conectarDB`, `PORT` en el cuerpo de `index.js`, `SECRETORPRIVATEKEY` en `generarJWT`) funciona igual, porque esas líneas corren después. Lo que se lee *al nivel superior de un módulo* depende del orden de los imports. Por eso dotenv va primero: no hay que acordarse de cuál variable se lee en qué momento.

Dato curioso: el código **original** tenía `import dotenv from "dotenv"; dotenv.config();` **después** de todos los imports, y funcionaba solo porque en ese momento ningún módulo leía variables de entorno al evaluarse.

### Reto 6.3 — Si la base de datos no responde

(`evidencias/6.3-sin-base-de-datos.txt`, con `MONGODB_URI` apuntando a un puerto donde no hay MongoDB.)

**Con el código actual:**
```
No se pudo conectar a MongoDB: connect ECONNREFUSED 127.0.0.1:27999
(terminó con código 1 después de 5 s)
```
El servidor **no arranca**: nunca abre el puerto. Lo provocan las líneas 15 y 21-22 de `src/DataBase/cnxmongo.js`:
```js
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
```
```js
        console.error("No se pudo conectar a MongoDB:", error.message);
        process.exit(1);
```
y el `await conectarDB()` de `index.js` (línea 34), que va **antes** de `app.listen`.

**Con el código original** el resultado era el mismo (no arrancaba), pero de mala manera: esperaba **31 segundos** (el tiempo por defecto de Mongoose para rendirse) y después se caía con un error sin manejar de más de 100 líneas:
```
./node_modules/mongoose/lib/connection.js:1172
    err = new ServerSelectionError();
          ^
MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27999
  … (más de 100 líneas con el estado interno del driver) …
Node.js v22.22.0
```
porque `x().then(...)` no tenía `.catch` y `x()` no tenía `try/catch`.

**¿Es la decisión correcta?** Hay razones para las dos posturas:
- **No arrancar (lo que elegimos):** sin base de datos esta API no puede responder ni una sola ruta útil. Si arrancara, recibiría peticiones y respondería 500 a todas; desde afuera parecería "viva" pero no serviría. Terminar con código 1 deja claro que algo está mal, y los programas que administran servidores (PM2, Docker, Kubernetes) reinician automáticamente un proceso que terminó con error.
- **Arrancar igual y reintentar:** Mongoose se reconecta solo y guarda en cola las consultas mientras no hay conexión. Si la base se cae unos segundos (un reinicio), la API vuelve sola sin intervención. Además, un servidor arriba puede responder un `503 Servicio no disponible` claro en vez de no responder nada.

Para un proyecto como el nuestro, donde la base es local y si no está es por un error de configuración, preferimos fallar rápido y con un mensaje claro. En producción tendría sentido una mezcla: no arrancar si la **primera** conexión falla, pero tolerar caídas **después** de arrancar.

### Reto 6.4 — `"type": "module"`

- **¿Qué cambia en nuestro código por tener esa línea?** Que todos los `.js` del proyecto son **módulos ES**. Por eso podemos usar `import`/`export` (y no `require`/`module.exports`), usar `await` fuera de una función (`index.js`, línea 34), y por eso no existen `__dirname` ni `require` en nuestros archivos. También por eso los imports propios llevan extensión.

- **Predicción:** al quitarla va a salir `SyntaxError: Cannot use import statement outside a module`.

- **Resultado** (`evidencias/6.4-sin-type-module.txt`):
  ```
  $ node --version
  v22.22.0
  $ node index.js      # sin "type": "module"
  (node:2811) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///./index.js is not specified and it doesn't parse as CommonJS.
  Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
  To eliminate this warning, add "type": "module" to ./package.json.
  Conexión exitosa a MongoDB
  Servidor corriendo en http://localhost:3000
  ```
  **La predicción falló.** En Node 22 el servidor **arrancó**, con una advertencia. Las versiones recientes de Node (22.7 en adelante, y 20.19 en adelante) tienen "detección de sintaxis": si un archivo `.js` sin `"type"` no se puede leer como CommonJS pero tiene sintaxis de módulo ES (`import`), Node lo vuelve a leer como módulo ES automáticamente. Lo hace archivo por archivo, y por eso avisa que es más lento.

  Para ver el error que esperábamos hay que desactivar esa detección, que es como se comporta un Node más viejo (por ejemplo Node 18):
  ```
  $ node --no-experimental-detect-module index.js
  (node:2796) Warning: Failed to load the ES module: ./index.js. Make sure to set "type": "module" in the nearest package.json file or use the .mjs extension.
  ./index.js:3
  import "dotenv/config";
  ^^^^^^

  SyntaxError: Cannot use import statement outside a module
  ```
  Conclusión: la línea sigue siendo necesaria. Sin ella, el proyecto depende de la versión de Node de cada computador: en el computador de alguien con un Node más viejo no arrancaría, y en todos sale la advertencia.

- **¿Por qué los imports propios llevan `.js` y `express` no?** Porque Node resuelve los dos tipos de forma distinta:
  - Un import **relativo** (`./src/DataBase/cnxmongo.js`) es una **ruta de archivo**, y en módulos ES Node la busca **tal cual**, sin adivinar extensiones (CommonJS sí probaba `.js`, `.json`, `/index.js`…). Lo probamos quitando la extensión (`evidencias/6.4b-sin-extension.txt`):
    ```
    Error [ERR_MODULE_NOT_FOUND]: Cannot find module './src/DataBase/cnxmongo' imported from ./index.js
    Did you mean to import "./src/DataBase/cnxmongo.js"?
    ```
  - Un import **sin ruta** (`"express"`, `"mongoose"`) es el **nombre de un paquete**. Node lo busca en `node_modules/express/`, lee su `package.json` y ahí encuentra (en `"exports"` o `"main"`) cuál es el archivo de entrada. La extensión la puso el autor del paquete en su `package.json`.

---

## Actividad final — Diseñar sin programar

Se especifican las siete funcionalidades. Formato común de error en todas: el mismo de `validarCampos` (`{"mensaje":"Error de validación","errores":[{"campo","mensaje"}]}`). Las rutas protegidas responden además `401 {"mensaje":"No hay token en la petición"}` sin `x-token`.

### A. Buscar por texto parcial — `GET /api/v1/readings?buscar=texto`

**1. Contrato HTTP**
- Query: `buscar` (opcional). Si no viene, se comporta como el listado normal.
- `200` — arreglo de lecturas cuyo `prompt` **o** `tipo_lectura` contiene el texto, sin importar mayúsculas: `[{"_id":"…","prompt":"¿Cómo va mi vida amorosa?","tipo_lectura":"amor", …}]`. Si nada coincide: `200 []` (no 404: la búsqueda funcionó, solo no hubo resultados).
- `400` — `{"mensaje":"Error de validación","errores":[{"campo":"buscar","mensaje":"La búsqueda debe tener entre 2 y 50 caracteres"}]}`.
- `400` — `buscar` repetido (`?buscar=a&buscar=b` llega como arreglo): `{"campo":"buscar","mensaje":"La búsqueda debe ser un solo texto"}`.

**2. Archivos:** modificar `src/validators/Readings.js` (nuevo `buscarReadingValidator`, con `query("buscar")`), `src/routers/Readings.js` (agregar el validator y `validarCampos` a `GET /`), `src/controllers/Readings.js` (un `listarReadings` propio que arme el filtro; la fábrica `listAll` no recibe filtros). Nuevo: ninguno.

**3. Reglas de validación**
- `buscar` es opcional.
- Si viene, debe ser un solo texto (no arreglo) → "La búsqueda debe ser un solo texto".
- Se le quitan los espacios de los extremos; después debe tener entre 2 y 50 caracteres → "La búsqueda debe tener entre 2 y 50 caracteres".

**4. Campos que el cliente no puede mandar:** ninguno de body (es un GET). No se acepta que el cliente elija **en qué campos** buscar: buscar en `respuesta` (hasta 5000 caracteres) sería muy lento sin índice.

**5. Relaciones:** ninguna (las lecturas no tienen `ref`).

**6. Caso límite:** el texto se usa para construir una **expresión regular**. Si el cliente manda `?buscar=(` o `.*`, sin escapar: `(` hace que la consulta falle (500) y `.*` coincide con todo. Además, ciertos patrones (`(a+)+$`) pueden tardar muchísimo (ReDoS). La especificación exige **escapar** los caracteres especiales (`. * + ? ^ $ { } ( ) | [ ] \`) para que se busquen como texto literal: `?buscar=(` busca lecturas que contengan el carácter `(`.

### B. Paginar — `GET /api/v1/readings?pagina=2&limite=10`

**1. Contrato HTTP**
- Query: `pagina` (opcional, por defecto 1), `limite` (opcional, por defecto 10).
- `200` — `{"datos":[…],"pagina":2,"limite":10,"total":37,"total_paginas":4}`.
- `200` — página mayor que `total_paginas` (`?pagina=99`): `{"datos":[],"pagina":99,"limite":10,"total":37,"total_paginas":4}`. No es 404: la petición es válida y el cliente necesita `total_paginas` para corregirse.
- `400` — `{"campo":"pagina","mensaje":"La página debe ser un entero mayor o igual a 1"}`; `{"campo":"limite","mensaje":"El límite debe ser un entero entre 1 y 100"}`.

**2. Archivos:** modificar `src/validators/Readings.js` (validator de query), `src/routers/Readings.js`, `src/utils/crudFactory.js` (`listAll` recibe `skip`/`limit` y cuenta con `countDocuments`), o un controller propio. **Cambia la forma de la respuesta** del listado (antes un arreglo, ahora un objeto): cualquier frontend que ya use `GET /readings` se rompe. Se debe acordar con el frontend o ponerlo solo cuando vengan los parámetros.

**3. Reglas de validación**
- `pagina`: opcional; si viene, entero ≥ 1 → "La página debe ser un entero mayor o igual a 1".
- `limite`: opcional; si viene, entero entre 1 y 100 → "El límite debe ser un entero entre 1 y 100".
- Los dos se convierten a número (`toInt`) antes de usarlos (en la query llegan como texto).

**4. Campos que el cliente no puede mandar:** no puede pedir un `limite` mayor a 100, para no traer la colección entera en una sola petición.

**5. Relaciones:** ninguna en lecturas. Si se aplicara a perfiles, el populate trae solo los usuarios de la página actual (el `$in` lleva como máximo `limite` ids).

**6. Caso límite:** sin un **orden fijo**, MongoDB no garantiza el orden de los documentos entre una consulta y otra, y el mismo documento puede salir en la página 1 y en la 2 (o no salir en ninguna). La especificación exige ordenar siempre por `_id` (que además es único, así que no hay empates). Y si alguien crea un documento mientras el cliente pasa de página, el último de la página 1 se repite como primero de la página 2: se acepta y se documenta.

### C. Ordenar — `GET /api/v1/numerology-profiles?ordenar=numero_vida&orden=desc`

**1. Contrato HTTP**
- Query: `ordenar` (opcional), `orden` (opcional, `asc` por defecto).
- `200` — arreglo de perfiles (poblados) ordenado por el campo pedido.
- `400` — `{"campo":"ordenar","mensaje":"Solo se puede ordenar por: numero_vida, numero_expresion, numero_alma, numero_destino, createdAt"}`.
- `400` — `{"campo":"orden","mensaje":"El orden debe ser asc o desc"}`.

**2. Archivos:** `src/validators/NumerologyProfiles.js` (validator de query), `src/routers/NumerologyProfiles.js`, `src/controllers/NumerologyProfiles.js` o `src/utils/crudFactory.js` (`.sort(...)`).

**3. Reglas**
- `ordenar`: opcional; si viene, debe estar en la lista blanca de campos → mensaje de arriba.
- `orden`: opcional; si viene, `asc` o `desc` (se acepta en mayúsculas convirtiéndolo con `toLowerCase`) → "El orden debe ser asc o desc".
- `orden` sin `ordenar` → se ignora (no es error).

**4. Campos que el cliente no puede usar:** `ordenar` no puede ser cualquier campo: ni `__v`, ni campos que no existen, ni operadores. Sin lista blanca, el valor iría directo a `.sort()`.

**5. Relaciones:** **no** se puede ordenar por un campo del documento poblado (`?ordenar=usuario_id.nombre_completo`): el `sort` lo hace MongoDB en la primera consulta, y en ese momento `usuario_id` todavía es un ObjectId (el populate llega después, en Node). Por eso no está en la lista blanca.

**6. Caso límite:** muchos perfiles tienen el mismo `numero_vida` (solo hay unos pocos valores posibles), y entre empatados el orden no está garantizado: dos peticiones iguales pueden devolver un orden distinto. La especificación exige agregar `_id` como segundo criterio de orden siempre (`{ numero_vida: -1, _id: 1 }`).

### D. Estadísticas — `GET /api/v1/numerology-profiles/estadisticas`

**1. Contrato HTTP**
- `200` — `{"total":3,"promedios":{"numero_vida":5,"numero_expresion":4,"numero_alma":4.67,"numero_destino":5},"por_numero_vida":[{"numero_vida":3,"cantidad":1},{"numero_vida":4,"cantidad":1},{"numero_vida":8,"cantidad":1}]}`.
- `200` — colección vacía: `{"total":0,"promedios":{"numero_vida":null,…},"por_numero_vida":[]}`.
- No recibe parámetros, así que no tiene errores 400 propios.

**2. Archivos:** `src/routers/NumerologyProfiles.js` (ruta nueva), `src/controllers/NumerologyProfiles.js` (función nueva con `aggregate`: `$group` para promedios y conteo).

**3. Reglas:** no hay entrada que validar.

**4. Campos que el cliente no puede mandar:** ninguno.

**5. Relaciones:** no se usa populate; las estadísticas son sobre números del propio perfil. `numero_destino` puede ser `null` (`default: null`): `$avg` ignora los `null`, así que el promedio de `numero_destino` es sobre los perfiles que lo tienen, y la respuesta debe decirlo (`"perfiles_con_numero_destino": 2`).

**6. Caso límite:** **el orden de la ruta** (reto 4.5). Si `router.get("/estadisticas", …)` se declara **después** de `router.get("/:id", …)`, la palabra `estadisticas` cae en `/:id` y responde 400 "El id proporcionado no es un ObjectId válido". La especificación exige declararla antes. Y con la colección vacía, promedio `null` (no `0`: 0 sería un dato falso).

### E. Borrado lógico — `DELETE /api/v1/readings/:id`

**1. Contrato HTTP**
- `DELETE /api/v1/readings/:id` (con token) → `200 {"mensaje":"Lectura eliminada correctamente"}`. El documento **no se borra**: queda con `activo: false` y `eliminado_en: <fecha>`.
- `GET /api/v1/readings` → `200` con solo las lecturas activas.
- `GET /api/v1/readings/:id` de una lectura desactivada → `404 {"mensaje":"Lectura no encontrada"}`.
- `PUT` o `DELETE` sobre una lectura desactivada → `404 {"mensaje":"Lectura no encontrada"}`.
- `400` id mal formado (igual que hoy); `404` id que nunca existió.

**2. Archivos:** `src/models/Readings.js` (campos `activo: { type: Boolean, default: true }` y `eliminado_en: { type: Date, default: null }`), `src/controllers/Readings.js` (eliminar = `findOneAndUpdate({ _id, activo: true }, { activo: false, eliminado_en: new Date() })`; listar/obtener/actualizar filtran `activo: true`). La fábrica no sirve tal cual: usa `findById`, que no filtra.

**3. Reglas:** las mismas de hoy (id con `isMongoId`). Ninguna regla nueva de entrada.

**4. Campos que el cliente no puede mandar:** `activo` y `eliminado_en`. **No** se agregan a `CAMPOS_ACEPTADOS`: si un cliente pudiera mandar `{"activo": true}` en un PUT, "resucitaría" lecturas borradas, y con `{"activo": false}` las borraría sin pasar por el DELETE.

**5. Relaciones:** hoy ninguna colección referencia a lecturas. Si en el futuro alguna lo hiciera, su populate seguiría encontrando la lectura desactivada (el documento existe): habría que decidir si se muestra o no.

**6. Caso límite:** **todos** los caminos de lectura tienen que filtrar `activo: true`, no solo el listado. Es fácil acordarse del `find()` del listado y olvidar el `findById` del GET por id, el del PUT, o un populate desde otra colección; la lectura "borrada" seguiría apareciendo por esa puerta. La especificación exige que el filtro esté en el modelo (un `pre(/^find/)` que agregue `activo: true`), no repetido en cada controller. Y un segundo DELETE sobre la misma lectura responde 404 (ya no está activa), no 200.

### F. Dos relaciones pobladas al tiempo — `GET /api/v1/compatibility-matches/:id`

(Ya está implementado en nuestra API: `src/controllers/CompatibilityMatches.js`, constante `POBLAR`.)

**1. Contrato HTTP**
- `200` — `{"_id":"…","usuario_id_1":{"_id":"…","nombre_completo":"Ana Gómez","email":"ana@test.com"},"usuario_id_2":{"_id":"…","nombre_completo":"Bruno Díaz","email":"bruno@test.com"},"puntaje_calculado":82, …}`.
- `400` — id mal formado: `{"campo":"id","mensaje":"El id proporcionado no es un ObjectId válido de MongoDB"}`.
- `404` — `{"mensaje":"Análisis de compatibilidad no encontrado"}`.

**2. Archivos:** `src/controllers/CompatibilityMatches.js` (arreglo `POBLAR` con dos `path`), `src/utils/crudFactory.js` (`getOne` recibe `populate`).

**3. Reglas:** el id con `isMongoId` (ya existe).

**4. Campos que el cliente no puede mandar:** no puede elegir qué campos del usuario se traen (`select` fijo en `nombre_completo email`): si pudiera, pediría `password_hash`.

**5. Relaciones:** dos `ref: "User"` (`usuario_id_1`, `usuario_id_2`). Mongoose hace 3 consultas (reto 5.2). Si uno de los usuarios no existiera, su campo llegaría `null` y el otro poblado normal; con los arreglos de los ataques #12 y #13 eso ya no puede pasar por la API.

**6. Caso límite:** `select: "nombre_completo email"` limita los campos, pero si alguien cambia el `select` a `""` o lo quita, el usuario poblado vendría con `password_hash`. La especificación exige que el hash se quite en el modelo (`toJSON` de `src/models/Users.js`), para que ningún populate lo pueda filtrar, sin depender de que cada `select` esté bien escrito.

### G. Impedir borrar si está referenciado — `DELETE /api/v1/users/:id`

(Ya está implementado: `src/middlewares/verificarDependencias.js`.)

**1. Contrato HTTP**
- `200` — usuario sin dependencias: `{"mensaje":"Usuario eliminado correctamente"}`.
- `409` — `{"mensaje":"No se puede eliminar el usuario porque otros registros dependen de él","dependencias":{"perfiles_numerologicos":1,"compatibilidades":2}}`.
- `400` — id mal formado; `404` — `{"mensaje":"Usuario no encontrado"}`; `401` — sin token.

**2. Archivos:** nuevo `src/middlewares/verificarDependencias.js`; modificado `src/routers/Users.js` (el middleware antes de `eliminarUsuario`).

**3. Reglas:** el id con `isMongoId`. La regla de negocio ("no tener dependientes") no es de formato: va en un middleware y responde 409, no 400.

**4. Campos que el cliente no puede mandar:** no hay un "forzar borrado" (`?forzar=true`). Si se necesitara, sería otra ruta solo para administradores.

**5. Relaciones:** se cuentan los documentos que apuntan al usuario: perfiles por `usuario_id` y compatibilidades por `usuario_id_1` **o** `usuario_id_2` (`$or`). Los audit-logs **no** bloquean: son historial y deben sobrevivir aunque el usuario no exista (su populate devolverá `null`).

**6. Caso límite:** el usuario aparece en compatibilidades **por dos campos distintos**. Si solo se revisara `usuario_id_1`, se podría borrar un usuario que figura únicamente como `usuario_id_2`, y su compatibilidad quedaría con un usuario `null`. El conteo tiene que usar `$or` sobre los dos campos. Otro caso: entre el conteo y el borrado alguien podría crear un perfil nuevo para ese usuario (unos milisegundos); se acepta para esta API y se documenta.
