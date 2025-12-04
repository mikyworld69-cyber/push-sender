import express from "express";
import cors from "cors";
import webpush from "web-push";
import mysql from "mysql2/promise";

// ===============================
// 1. CONFIG VAPID
// ===============================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
    "mailto:admin@iappsweb.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// ===============================
// 2. EXPRESS
// ===============================
const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// 3. CONEXIÓN MYSQL (PlanetScale)
// ===============================
let db;

async function initDB() {
    db = await mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        ssl: {
            rejectUnauthorized: true
        }
    });

    console.log("MySQL PlanetScale conectado ✔");
}

// ===============================
// 4. FUNCIONES
// ===============================
async function obtenerSuscripciones() {
    const [rows] = await db.query("SELECT * FROM push_subscriptions");
    return rows;
}

async function enviarNotificacionATodos(payload) {
    const subs = await obtenerSuscripciones();
    const resultados = [];

    for (const s of subs) {
        try {
            const r = await webpush.sendNotification(
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
                status: r.statusCode
            });

        } catch (err) {
            resultados.push({
                endpoint: s.endpoint,
                status: err.statusCode || 500,
                error: err.body || "error"
            });

            // borrar subs inválidas
            if (err.statusCode >= 400) {
                await db.query("DELETE FROM push_subscriptions WHERE endpoint = ?", [s.endpoint]);
            }
        }
    }

    return resultados;
}

// ===============================
// 5. RUTAS
// ===============================
app.get("/", (req, res) => {
    res.send("Servidor Push funcionando ✔");
});

app.get("/send", async (req, res) => {
    const payload = {
        title: req.query.title || "Test",
        body: req.query.message || "Mensaje de prueba",
        icon: "https://iappsweb.com/tu-proyecto-cupones/public/icons/icon-192.png",
        url: "/"
    };

    const resultados = await enviarNotificacionATodos(payload);
    res.json(resultados);
});

app.post("/send", async (req, res) => {
    const payload = req.body;
    const resultados = await enviarNotificacionATodos(payload);
    res.json(resultados);
});

// ===============================
// 6. INICIAR SERVIDOR
// ===============================
async function start() {
    await initDB();
    const PORT = process.env.PORT || 10000;

    app.listen(PORT, () => {
        console.log("Servidor Push en puerto", PORT);
    });
}

start();
