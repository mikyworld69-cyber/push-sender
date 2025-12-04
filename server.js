// server.js — Push Sender con PlanetScale PostgreSQL
import express from "express";
import cors from "cors";
import webpush from "web-push";
import pkg from "pg";
const { Pool } = pkg;

// =====================================================
// 1) VAPID KEYS
// =====================================================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

console.log("PUBLIC KEY:", VAPID_PUBLIC_KEY);
console.log("PRIVATE KEY:", VAPID_PRIVATE_KEY);

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("❌ Faltan claves VAPID en variables de entorno");
    process.exit(1);
}

webpush.setVapidDetails(
    "mailto:admin@iappsweb.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// =====================================================
// 2) PostgreSQL PlanetScale
// =====================================================
console.log("DEBUG PG ENV:", {
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    pass: "***",
    db: process.env.DB_DATABASE
});

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: false }
});

// Test de conexión
pool.connect()
    .then(() => console.log("PostgreSQL conectado ✔"))
    .catch(err => {
        console.error("❌ Error conectando a PostgreSQL:", err);
    });

// =====================================================
// 3) EXPRESS
// =====================================================
const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 4) FUNCIONES PUSH
// =====================================================
async function obtenerSuscripciones() {
    const sql = "SELECT endpoint, p256dh, auth FROM push_subs";
    const result = await pool.query(sql);
    return result.rows;
}

async function enviarNotificacionATodos(payload) {
    const subs = await obtenerSuscripciones();
    const resultados = [];

    for (const s of subs) {
        try {
            const r = await webpush.sendNotification(
                {
                    endpoint: s.endpoint,
                    keys: { p256dh: s.p256dh, auth: s.auth }
                },
                JSON.stringify(payload)
            );

            resultados.push({
                endpoint: s.endpoint,
                http: r.statusCode,
                success: r.statusCode >= 200 && r.statusCode < 300
            });

        } catch (err) {
            resultados.push({
                endpoint: s.endpoint,
                http: err.statusCode || 0,
                success: false,
                error: err.body
            });

            if (err.statusCode >= 400) {
                await pool.query("DELETE FROM push_subs WHERE endpoint = $1", [s.endpoint]);
            }
        }
    }

    return resultados;
}

// =====================================================
// 5) Rutas HTTP
// =====================================================
app.get("/", (req, res) => {
    res.send("Servidor de Push Notifications operativo ✔");
});

app.get("/send", async (req, res) => {
    const payload = {
        title: req.query.title || "Notificación",
        body: req.query.message || "Mensaje",
        icon: "https://iappsweb.com/tu-proyecto-cupones/public/icons/icon-192.png",
        url: "/"
    };

    try {
        const resultados = await enviarNotificacionATodos(payload);
        res.json({ enviados: resultados.length, resultados });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post("/send", async (req, res) => {
    const { title, message, icon, url } = req.body;

    const payload = {
        title: title || "Notificación",
        body: message || "",
        icon: icon || "https://iappsweb.com/tu-proyecto-cupones/public/icons/icon-192.png",
        url: url || "/"
    };

    try {
        const resultados = await enviarNotificacionATodos(payload);
        res.json({ enviados: resultados.length, resultados });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// =====================================================
// 6) Iniciar servidor
// =====================================================
const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
    console.log("Servidor Push en puerto", PORT);
});
