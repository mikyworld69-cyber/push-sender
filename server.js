// =====================================================
// PUSH SERVER - VERSION POSTGRESQL COMPLETA Y FUNCIONAL
// =====================================================

import express from "express";
import cors from "cors";
import webpush from "web-push";
import pkg from "pg";

// PostgreSQL Client
const { Pool } = pkg;

// =====================================================
// 1) VAPID KEYS
// =====================================================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

console.log("PUBLIC KEY:", VAPID_PUBLIC_KEY);
console.log("PRIVATE KEY:", VAPID_PRIVATE_KEY);

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("❌ ERROR: Faltan claves VAPID");
    process.exit(1);
}

webpush.setVapidDetails(
    "mailto:admin@iappsweb.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// =====================================================
// 2) EXPRESS
// =====================================================
const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 3) POSTGRESQL POOL
// =====================================================
console.log("DEBUG PG ENV:", {
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    pass: "***",
    db: process.env.DB_DATABASE
});

const db = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: 5432,
    ssl: { rejectUnauthorized: false }
});

// Test de conexión
db.connect()
    .then(() => console.log("PostgreSQL conectado ✔"))
    .catch(err => {
        console.error("❌ Error al conectar PG:", err);
        process.exit(1);
    });

// =====================================================
// 4) FUNCIONES NOTIFICACIÓN
// =====================================================
async function obtenerSuscripciones() {
    const res = await db.query("SELECT * FROM push_subscriptions");
    return res.rows;
}

async function enviarNotificacionATodos(payload) {
    const subs = await obtenerSuscripciones();
    const resultados = [];

    for (const s of subs) {
        try {
            const result = await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth }},
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
                success: false,
                error: err.body || err.message
            });

            if (err.statusCode >= 400) {
                await db.query(
                    "DELETE FROM push_subscriptions WHERE endpoint = $1",
                    [s.endpoint]
                );
            }
        }
    }

    return { enviados: subs.length, resultados };
}

// =====================================================
// 5) RUTAS
// =====================================================

app.get("/", (req, res) => {
    res.send("Servidor Push PostgreSQL ✔ funcionando");
});

// LISTAR SUSCRIPTORES
app.get("/suscriptores", async (req, res) => {
    const subs = await obtenerSuscripciones();
    res.json(subs);
});

// ENVIAR NOTIFICACIÓN (GET)
app.get("/send", async (req, res) => {
    const payload = {
        title: req.query.title || "Notificación",
        body: req.query.message || "Mensaje desde Push Server",
        icon: "https://iappsweb.com/tu-proyecto-cupones/public/icons/icon-192.png",
        url: "/"
    };

    const resultado = await enviarNotificacionATodos(payload);
    res.json(resultado);
});

// ENVIAR NOTIFICACIÓN (POST)
app.post("/send", async (req, res) => {
    const payload = {
        title: req.body.title,
        body: req.body.message,
        icon: req.body.icon,
        url: req.body.url
    };

    const resultado = await enviarNotificacionATodos(payload);
    res.json(resultado);
});

// =====================================================
// 6) INICIAR SERVER
// =====================================================

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
    console.log("Servidor Push en puerto", PORT);
});
