// =============================================================
//  SERVER PUSH — PLANETSCALE POSTGRES — VERSION FINAL
// =============================================================

import express from "express";
import cors from "cors";
import webpush from "web-push";
import pkg from "pg";
const { Pool } = pkg;

// =============================================================
// 1) CARGAR CLAVES VAPID DESDE VARIABLES DE ENTORNO
// =============================================================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

console.log("PUBLIC KEY:", VAPID_PUBLIC_KEY);
console.log("PRIVATE KEY:", VAPID_PRIVATE_KEY);

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("❌ ERROR: No hay claves VAPID configuradas en Render");
    process.exit(1);
}

webpush.setVapidDetails(
    "mailto:admin@iappsweb.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);
// PANEL ADMIN: LISTAR SUSCRIPTORES
app.get("/suscriptores", async (req, res) => {
    try {
        const subs = await obtenerSuscripciones();
        res.json(subs);
    } catch (err) {
        console.error("Error /suscriptores:", err);
        res.status(500).json({ ok: false, error: "server_error" });
    }
});

// =============================================================
// 2) CONEXIÓN A PLANETSCALE POSTGRES
// =============================================================
console.log("DEBUG PG ENV:", {
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    db: process.env.PGDATABASE,
    pass: "***"
});

const pool = new Pool({
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: process.env.PGPORT,
    ssl: { rejectUnauthorized: false }
});

// Test de conexión
pool.connect()
    .then(() => console.log("PostgreSQL conectado ✔"))
    .catch(err => {
        console.error("❌ Error al conectar PG:", err);
        process.exit(1);
    });

// =============================================================
// 3) EXPRESS APP
// =============================================================
const app = express();
app.use(cors());
app.use(express.json());

// =============================================================
// 4) FUNCIONES BD + NOTIFICACIONES
// =============================================================
async function obtenerSuscripciones() {
    const res = await pool.query(`SELECT * FROM push_subscriptions`);
    return res.rows;
}

async function enviarNotificacionATodos(payload) {
    const subs = await obtenerSuscripciones();

    const resultados = [];

    for (const s of subs) {
        try {
            const result = await webpush.sendNotification(
                {
                    endpoint: s.endpoint,
                    keys: {
                        p256dh: s.p256dh,
                        auth: s.auth
                    }
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
                success: false,
                error: err.body
            });

            // Si el endpoint ya no sirve → borrarlo
            if (err.statusCode >= 400) {
                await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [s.endpoint]);
            }
        }
    }

    return {
        enviados: subs.length,
        resultados
    };
}

// =============================================================
// 5) RUTAS EXPRESS
// =============================================================
app.get("/", (req, res) => {
    res.send("Servidor Push funcionando ✔");
});

app.get("/send", async (req, res) => {
    const payload = {
        title: req.query.title || "Título",
        body: req.query.message || "Mensaje",
        icon: "https://iappsweb.com/tu-proyecto-cupones/public/icon-192.png",
        url: "/"
    };

    const resultado = await enviarNotificacionATodos(payload);
    res.json(resultado);
});

app.post("/send", async (req, res) => {
    const { title, message, icon, url } = req.body;

    const payload = {
        title: title || "Notificación",
        body: message || "Mensaje desde servidor Push",
        icon: icon || "https://iappsweb.com/tu-proyecto-cupones/public/icon-192.png",
        url: url || "/"
    };

    const resultado = await enviarNotificacionATodos(payload);
    res.json(resultado);
});

// =============================================================
// 6) INICIAR SERVIDOR
// =============================================================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log("Servidor Push en puerto", PORT);
});
console.log("SW cargado ✔");

self.addEventListener("install", () => {
    console.log("SW instalado ✔");
    self.skipWaiting();
});

self.addEventListener("activate", () => {
    console.log("SW activado ✔");
    self.clients.claim();
});

// RECIBIR PUSH
self.addEventListener("push", e => {
    let data = {};
    try { data = e.data.json(); }
    catch { data = { body: e.data.text() }; }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge || data.icon,
        data: data.url,
        vibrate: [100, 30, 100]
    };

    e.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// CLICK
self.addEventListener("notificationclick", e => {
    e.notification.close();

    e.waitUntil(
        clients.openWindow(e.notification.data)
    );
});

