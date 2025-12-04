import express from "express";
import cors from "cors";
import webpush from "web-push";
import mysql from "mysql2/promise";

// =============================================================
// 1) VARIABLES DE ENTORNO (Render)
// =============================================================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASS = process.env.DB_PASS;
const DB_NAME = process.env.DB_NAME;

console.log("PUBLIC KEY:", VAPID_PUBLIC_KEY);
console.log("PRIVATE KEY:", VAPID_PRIVATE_KEY);

// =============================================================
// 2) VALIDACIÓN VAPID
// =============================================================
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("❌ ERROR: Faltan claves VAPID en Render.");
    process.exit(1);
}

webpush.setVapidDetails(
    "mailto:admin@iappsweb.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// =============================================================
// 3) EXPRESS APP
// =============================================================
const app = express();
app.use(cors());
app.use(express.json());

// =============================================================
// 4) MYSQL (STRATO) – Crear pool
// =============================================================
let db;

async function conectarDB() {
    try {
        db = await mysql.createPool({
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASS,
            database: DB_NAME,
        });

        console.log("MySQL STRATO conectado ✔");

    } catch (err) {
        console.error("❌ ERROR MySQL:", err);
        process.exit(1);
    }
}

// =============================================================
// 5) FUNCIONES PUSH
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
                    keys: {
                        p256dh: s.p256dh,
                        auth: s.auth,
                    },
                },
                JSON.stringify(payload)
            );

            resultados.push({
                endpoint: s.endpoint,
                http: result.statusCode,
                success: result.statusCode >= 200 && result.statusCode < 300,
            });

        } catch (err) {
            resultados.push({
                endpoint: s.endpoint,
                success: false,
                http: err.statusCode || 0,
                error: err.body,
            });

            // Si la suscripción está muerta → se elimina
            if (err.statusCode === 410 || err.statusCode === 404) {
                await db.query("DELETE FROM push_subscriptions WHERE endpoint = ?", [s.endpoint]);
            }
        }
    }

    return {
        enviados: subs.length,
        resultados,
    };
}

// =============================================================
// 6) RUTAS
// =============================================================

// ✔ Test
app.get("/", (req, res) => {
    res.send("Servidor Push funcionando ✔");
});

// ✔ LISTA SUSCRIPTORES
app.get("/suscriptores", async (req, res) => {
    try {
        const data = await obtenerSuscripciones();
        res.json(data);
    } catch (e) {
        console.error("Error /suscriptores:", e);
        res.status(500).json({ ok: false });
    }
});

// ✔ ENVÍO POR GET
app.get("/send", async (req, res) => {
    const payload = {
        title: req.query.title || "Test",
        body: req.query.message || "Mensaje desde GET",
        icon: "https://iappsweb.com/tu-proyecto-cupones/public/icons/icon-192.png",
        url: "/",
    };

    const out = await enviarNotificacionATodos(payload);
    res.json(out);
});

// ✔ ENVÍO POR POST
app.post("/send", async (req, res) => {
    const { title, message, icon, url } = req.body;

    const payload = {
        title: title || "Notificación",
        body: message || "Mensaje desde servidor push",
        icon: icon || "https://iappsweb.com/tu-proyecto-cupones/public/icons/icon-192.png",
        url: url || "/",
    };

    const out = await enviarNotificacionATodos(payload);
    res.json(out);
});

// =============================================================
// 7) INICIAR SERVIDOR
// =============================================================
async function iniciar() {
    await conectarDB();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, "0.0.0.0", () => {
        console.log("Servidor Push en puerto", PORT);
    });
}

iniciar();
