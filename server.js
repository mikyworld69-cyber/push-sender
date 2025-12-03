import express from "express";
import cors from "cors";
import webpush from "web-push";
import mysql from "mysql2/promise";

// =============================================================
// 1) VAPID KEYS
// =============================================================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

console.log("PUBLIC KEY:", VAPID_PUBLIC_KEY);
console.log("PRIVATE KEY:", VAPID_PRIVATE_KEY);

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("❌ ERROR: Faltan claves VAPID en Render");
    process.exit(1);
}

// Configurar WebPush
webpush.setVapidDetails(
    "mailto:admin@iappsweb.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// =============================================================
// 2) CONEXIÓN MYSQL (STRATO)
// =============================================================
let db;

async function initDB() {
    db = await mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0
    });

    console.log("MySQL STRATO conectado ✔");
}

// =============================================================
// 3) Funciones de notificaciones
// =============================================================
async function obtenerSuscripciones() {
    const [rows] = await db.query("SELECT * FROM push_subscriptions");
    return rows;
}

async function enviarNotificacionATodos(payload) {
    const subs = await obtenerSuscripciones();
    const resultados = [];

    for (const s of subs) {
        try {
            const result = await webpush.sendNotification(
                {
                    endpoint: s.endpoint,
                    keys: { p256dh: s.p256dh, auth: s.auth },
                },
                JSON.stringify(payload)
            );

            resultados.push({
                endpoint: s.endpoint,
                http: result.statusCode,
                success: result.statusCode >= 200 && result.statusCode < 300
            });

        } catch (error) {
            resultados.push({
                endpoint: s.endpoint,
                http: error.statusCode || 0,
                success: false,
                error: error.body
            });

            // Eliminar suscripciones inválidas
            if (error.statusCode >= 400) {
                await db.query(
                    "DELETE FROM push_subscriptions WHERE endpoint = ?",
                    [s.endpoint]
                );
            }
        }
    }

    return { enviados: subs.length, resultados };
}

// =============================================================
// 4) EXPRESS
// =============================================================
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Servidor PUSH iAppsWeb activo ✔");
});

// GET: enviar notificación sencilla
app.get("/send", async (req, res) => {
    const payload = {
        title: req.query.title || "Título de prueba",
        body: req.query.message || "Mensaje de prueba",
        icon: "https://iappsweb.com/tu-proyecto-cupones/public/icons/icon-192.png",
        url: "/"
    };

    const resultado = await enviarNotificacionATodos(payload);
    res.json(resultado);
});

// POST: enviar notificación personalizada
app.post("/send", async (req, res) => {
    const { title, message, icon, url } = req.body;

    const payload = {
        title: title || "Notificación",
        body: message || "Mensaje enviado desde el servidor",
        icon: icon || "https://iappsweb.com/tu-proyecto-cupones/public/icons/icon-192.png",
        url: url || "/"
    };

    const resultado = await enviarNotificacionATodos(payload);
    res.json(resultado);
});

// =============================================================
// 5) INICIAR SERVIDOR
// =============================================================
async function start() {
    await initDB();

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, "0.0.0.0", () => {
        console.log("Servidor Push en puerto", PORT);
    });
}

start();
