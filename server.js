// ===============================
// SERVIDOR PUSH - DEFINITIVO STRATO
// ===============================

import express from "express";
import cors from "cors";
import webpush from "web-push";
import mysql from "mysql2/promise";

// ===============================
// 1) VAPID KEYS
// ===============================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
    "mailto:admin@iappsweb.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// ===============================
// 2) CONEXIÓN MYSQL STRATO
// ===============================
console.log("DEBUG STRATO:", {
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    db: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
});

let pool;

async function initDB() {
    pool = await mysql.createPool({
        host: process.env.DB_HOST,              // gcp.connect.psdb.cloud
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        port: 3306,

        ssl: {
            rejectUnauthorized: true
        },

        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0
    });

    console.log("MySQL PlanetScale conectado ✔");
}

    console.log("MySQL STRATO conectado ✔");
}


// ===============================
// 3) FUNCIONES DB
// ===============================
async function obtenerSuscripciones() {
    try {
        const [rows] = await pool.query("SELECT * FROM push_subscriptions");
        return rows;
    } catch (e) {
        console.error("❌ ERROR SELECT:", e);
        return [];
    }
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

        } catch (error) {

            resultados.push({
                endpoint: s.endpoint,
                http: error.statusCode || 0,
                success: false,
                error: error.body
            });

            // Si el endpoint ya no existe → borrar
            if (error.statusCode >= 400) {
                await pool.query(
                    "DELETE FROM push_subscriptions WHERE endpoint = ?",
                    [s.endpoint]
                );
            }
        }
    }

    return { enviados: subs.length, resultados };
}

// ===============================
// 4) EXPRESS
// ===============================
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Servidor Push funcionando con STRATO ✔");
});

app.get("/suscriptores", async (req, res) => {
    const subs = await obtenerSuscripciones();
    res.json(subs);
});

app.get("/send", async (req, res) => {
    const payload = {
        title: req.query.title || "Título",
        body: req.query.message || "Mensaje",
        icon: "https://iappsweb.com/tu-proyecto-cupones/public/icon-192.png",
        url: "/"
    };

    const out = await enviarNotificacionATodos(payload);
    res.json(out);
});

// ===============================
// 5) INICIAR SERVIDOR
// ===============================
async function iniciar() {
    await initDB();

    const PORT = process.env.PORT || 10000;
    app.listen(PORT, "0.0.0.0", () =>
        console.log("Servidor Push activo en puerto", PORT)
    );
}

iniciar();
