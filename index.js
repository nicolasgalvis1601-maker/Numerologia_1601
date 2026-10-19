// dotenv va PRIMERO: carga el .env en process.env antes de que se evalúe
// cualquier otro módulo que lea variables de entorno.
import "dotenv/config";
import express from "express";
import { conectarDB } from "./src/DataBase/cnxmongo.js";

import UsersRoutes from "./src/routers/Users.js";
import NumerologyProfilesRoutes from "./src/routers/NumerologyProfiles.js";
import CompatibilityMatchesRoutes from "./src/routers/CompatibilityMatches.js";
import ReadingsRoutes from "./src/routers/Readings.js";
import AuditLogsRoutes from "./src/routers/AuditLogs.js";
import { rutaNoEncontrada, manejadorErrores } from "./src/middlewares/manejoErrores.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Lee el body de las peticiones con Content-Type: application/json y lo deja
// convertido en objeto en req.body. Tiene que ir ANTES de las rutas.
app.use(express.json());

app.use("/api/v1/users", UsersRoutes);
app.use("/api/v1/numerology-profiles", NumerologyProfilesRoutes);
app.use("/api/v1/compatibility-matches", CompatibilityMatchesRoutes);
app.use("/api/v1/readings", ReadingsRoutes);
app.use("/api/v1/audit-logs", AuditLogsRoutes);

// Si ninguna ruta respondió: 404 en JSON (en vez del HTML de Express).
app.use(rutaNoEncontrada);

// Manejador de errores (4 parámetros). Tiene que ir de último.
app.use(manejadorErrores);

// Primero se conecta a MongoDB y solo después se abre el puerto.
await conectarDB();

app.listen(PORT, (error) => {
    // En Express 5 el callback recibe el error (por ejemplo, puerto ocupado).
    // Sin este if el servidor diría "corriendo" aunque no lo esté.
    if (error) {
        console.error(`No se pudo abrir el puerto ${PORT}:`, error.message);
        process.exit(1);
    }
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
