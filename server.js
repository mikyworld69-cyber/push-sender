import express from "express";
import cors from "cors";
import webpush from "web-push";
import pkg from "pg";

const { Pool } = pkg;

// =============================================================
// 1) VAPID KEYS
// =============================================================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

console.log("PUBLIC KEY:", VAPID_PUBLIC_KEY);
console.log("PRIVATE KEY:", VAPID_PRIVATE_KEY);

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("❌ Faltan claves VAPID");
    process.exit(1);
}

webpush.setVapidDetails(
    "mailto:admin@iappsweb.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// =============================================================
// 2) EXPRESS
// =============================================================
const app = express();
app.use(cors());
app.use(express.json());

// =============================================================
// 3) POSTGRES
// =============================================================

const db = new Pool({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER,
    password: process.env.PG_PASS,
    database: process.env.PG_DB,
    ssl: { rejectUnauthorized: false }
});

db.connect()
  .then(() => console.log("PostgreSQL conectado ✔"))
  .catch(err => {
      console.error("❌ Error al conectar a PostgreSQL:", err);
      process.exit(1);
  });

// =============================================================
// 4) FUNCIONES DE NOTIFICACIÓN
// =============================================================

async function obtenerSuscripciones() {
    const result = await db.query("SELECT * FROM push_subscriptions");
    return result.rows;
}

async function enviarNotificacionATodos(payload) {
    const subs = await obtenerSuscripciones();
    const resultados = [];

    for (const s of subs) {
        try {
            const result = await webpush.sendNotification(
                {
                    endpoint: s.endpoint,
                    keys: { p256dh: s.p256dh, auth: s.auth }
                },
                JSON.stringify(payload)
            );

            resultados.push({
                endpoint: s.endpoint,
                http: result.statusCode,
                success: result.statusCode >= 200 && result.statusCode < 300
            });

        } catch (err) {

            resultados.push({
                endpoint: s.endpoint,
                http: err.statusCode || 0,
                error: err.body,
                success: false
            });

            // Eliminar suscripciones inválidas
            if (err.statusCode >= 400) {
                await db.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [s.endpoint]);
            }
        }
    }

    return { enviados: subs.length, resultados };
}

// =============================================================
// 5) RUTAS
// =============================================================

app.get("/", (req, res) => {
    res.send("Servidor Push funcionando ✔");
});

app.get("/send", async (req, res) => {
    const payload = {
        title: req.query.title || "Test GET",
        body: req.query.message || "Mensaje de prueba",
        icon: "https://iappsweb.com/tu-proyecto-cupones/public/icon-192.png",
        url: "/"
    };

    res.json(await enviarNotificacionATodos(payload));
});

app.post("/send", async (req, res) => {
    const { title, message, icon, url } = req.body;

    const payload = {
        title: title || "Notificación",
        body: message || "Mensaje desde Render Push",
        icon: icon || "https://iappsweb.com/tu-proyecto-cupones/public/icon-192.png",
        url: url || "/"
    };

    res.json(await enviarNotificacionATodos(payload));
});

// =============================================================
// 6) INICIAR SERVIDOR
// =============================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
    console.log("Servidor Push en puerto", PORT)
);
