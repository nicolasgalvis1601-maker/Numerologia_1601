# API de Numerología

API REST con **Express 5**, **Mongoose 9** y **express-validator 7**. Cinco colecciones: usuarios, perfiles numerológicos, compatibilidades, lecturas y registros de auditoría.

## Cómo correrla

```bash
npm install
cp .env.example .env        # y completar SECRETORPRIVATEKEY con cualquier texto
npm run seed                # datos de prueba: 3 documentos por colección (BORRA lo que haya)
npm run dev                 # http://localhost:3000
```

Variables del `.env`:

| Variable | Para qué |
|:--|:--|
| `PORT` | Puerto (por defecto 3000) |
| `MONGODB_URI` | Conexión a MongoDB (por defecto `mongodb://127.0.0.1:27017/trabajodenumologia`) |
| `SECRETORPRIVATEKEY` | Clave para firmar los JWT |
| `MONGOOSE_DEBUG` | `true` para ver en consola cada consulta que Mongoose manda a MongoDB |

Usuarios de prueba que crea `npm run seed`: `ana@test.com`, `bruno@test.com`, `carla@test.com`, todos con contraseña `secreto123`.

## Endpoints

Las rutas marcadas con 🔒 necesitan el header `x-token` con el token que devuelve el login.

| Recurso | Rutas |
|:--|:--|
| Usuarios `/api/v1/users` | `POST /` (registro) · `POST /login` · 🔒 `GET /` · 🔒 `GET /:id` · 🔒 `PUT /:id` · 🔒 `DELETE /:id` (409 si tiene perfiles o compatibilidades) |
| Perfiles `/api/v1/numerology-profiles` | `GET /` · `GET /:id` · 🔒 `POST /` · 🔒 `PUT /:id` · 🔒 `DELETE /:id` — pueblan `usuario_id` |
| Compatibilidades `/api/v1/compatibility-matches` | `GET /` · `GET /:id` · 🔒 `POST /` · 🔒 `PUT /:id` · 🔒 `DELETE /:id` — pueblan `usuario_id_1` y `usuario_id_2` |
| Lecturas `/api/v1/readings` | `GET /` · `GET /:id` · 🔒 `POST /` · 🔒 `PUT /:id` · 🔒 `DELETE /:id` |
| Auditoría `/api/v1/audit-logs` | 🔒 todas: `GET /` · `GET /:id` · `POST /` · `PUT /:id` · `DELETE /:id` — pueblan `user_id` |

Formato de los errores:

```json
{ "mensaje": "Error de validación", "errores": [ { "campo": "email", "mensaje": "El email es obligatorio" } ] }
```

| Código | Cuándo |
|:-:|:--|
| 400 | Datos inválidos, id mal formado, JSON mal escrito, referencia a un usuario que no existe |
| 401 | Sin token, token inválido o credenciales incorrectas |
| 404 | El documento no existe, o la ruta/método no existe |
| 409 | Email repetido, o borrar un usuario con dependientes |
| 500 | Error inesperado del servidor (el detalle solo se ve en la consola) |

## Estructura

```
index.js                         arranque: dotenv, middlewares, rutas, manejo de errores, conexión, listen
src/DataBase/cnxmongo.js         conexión a MongoDB
src/models/                      schemas de Mongoose
src/validators/                  reglas de express-validator (reglasComunes.js: valorSimple, usuarioExiste)
src/middlewares/                 validarCampos, validarJWT, verificarDependencias, manejoErrores
src/controllers/                 configuración de cada colección (lista blanca, relaciones a poblar)
src/utils/crudFactory.js         CRUD genérico que usan los controllers
scripts/seed.js                  datos de prueba
laboratorio/                     laboratorio de ataque y defensa
analisis-api.md                  guía de análisis de la API
```

## Laboratorio

- `laboratorio/informe-ataque.md` — los 14 ataques (+1 propio), ronda 1 y ronda 2
- `laboratorio/bitacora-reparacion.md` — priorización y cada arreglo con su diagnóstico
- `laboratorio/defensa-tecnica.md` — las 6 preguntas, citando el código
- `laboratorio/pruebas/` — script de ataques y la evidencia de cada ronda (`npm run ataques`, o `npm run ataques -- <url-del-túnel>` para atacar otra API)
- `laboratorio/evidencias/` — salidas de consola de cada experimento de `analisis-api.md`
