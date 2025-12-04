import express from "express";
import cors from "cors";
import webpush from "web-push";
import mysql from "mysql2/promise";

// ===============================
// 1) VAPID KEYS
// ===============================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

console.log("PUBLIC KEY:", VAPID_PUBLIC_KEY);
console.log("PRIVATE KEY:", VAPID_PRIVATE_KEY);

webpush.setVapidDetails(
    "mailto:admin@iappsweb.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// ===============================
// 2) EXPRESS
// ===============================
const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// 3) MYSQL - STRATO
// ===============================

let db;
async function initDB() {

    db = await mysql.createPool({
        host: "database-5018992042.webspace-host.com",
        user: "dbu4029641",
        password: "Mike91078@@",
        database: "dbs14956516",
    });

    console.log("MySQL STRATO conectado ✔");
}

// ===============================
// 4) FUNCIONES PUSH
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

            if (error.statusCode >= 400) {
                await db.query("DELETE FROM push_subscriptions WHERE endpoint = ?", [s.endpoint]);
            }
        }
    }

    return { enviados: subs.length, resultados };
}

// ===============================
// 5) RUTAS
// ===============================
app.get("/", (req, res) => {
    res.send("Servidor Push OK ✔");
});

app.get("/send", async (req, res) => {
    const payload = {
        title: req.query.title || "Notificación",
        body: req.query.message || "Mensaje",
        icon: "https://iappsweb.com/tu-proyecto-cupones/public/icons/icon-192.png",
        url: "/"
    };

    const resultado = await enviarNotificacionATodos(payload);
    res.json(resultado);
});

// ===============================
// 6) INICIO
// ===============================
async function iniciar() {
    await initDB();
    const PORT = process.env.PORT || 10000;

    app.listen(PORT, "0.0.0.0", () => {
        console.log("Servidor Push en puerto", PORT);
    });
}

iniciar();
