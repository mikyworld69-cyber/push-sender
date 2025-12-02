// =============================================================
//  PUSH SENDER · iappsweb.com
//  Servidor Node para enviar notificaciones Web Push
//  Express + WebPush + MySQL + Render compatible
// =============================================================

import express from "express";
import cors from "cors";
import webpush from "web-push";
import mysql from "mysql2/promise";

// =============================================================
// 1) LEER CLAVES DESDE VARIABLES DE ENTORNO
// =============================================================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

console.log("PUBLIC KEY:", VAPID_PUBLIC_KEY);
console.log("PRIVATE KEY:", VAPID_PRIVATE_KEY);

// VALIDACIÓN
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("❌ ERROR: Las claves VAPID NO están definidas en Render.");
    process.exit(1);
}

// Configuración de WebPush
webpush.setVapidDetails(
    "mailto:admin@iappsweb.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// =============================================================
// 2) CONEXIÓN A MYSQL (LOS DATOS DEBEN IR EN RENDER ENV)
// =============================================================
const db = await mysql.createPool({
    host: process.env.MYSQL_HOST, 
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB
});

// =============================================================
// 3) EXPRESS
// =============================================================
const app = express();
app.use(cors());
app.use(express.json());

// =============================================================
// 4) RUTA RAÍZ → Para comprobar que el servidor está vivo
// =============================================================
app.get("/", (req, res) => {
    res.send("Push sender funcionando ✔");
});

// =============================================================
// 5) OBTENER SUSCRIPCIONES DE LA BD
// =============================================================
async function obtenerSuscripciones() {
    const [rows] = await db.query("SELECT * FROM push_subscriptions");
    return rows;
}

// =============================================================
// 6) ENVIAR NOTIFICACIÓN A TODAS LAS SUSCRIPCIONES
// =============================================================
async function enviarNotificacionATodos(payload) {
    const subs = await obtenerSuscripciones();

    if (!subs.length) {
        console.log("⚠️ No hay suscriptores.");
        return { enviados: 0, resultados: [] };
    }

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
        } catch (error) {
            resultados.push({
                endpoint: s.endpoint,
                http: error.statusCode || 0,
                success: false,
                error: error.body
            });

            // Si está caducada → borrar
            if (error.statusCode >= 400) {
                await db.query("DELETE FROM push_subscriptions WHERE endpoint = ?", [s.endpoint]);
            }
        }
    }

    return { enviados: subs.length, resultados };
}

// =============================================================
// 7) RUTA POST /send (para enviar notificación real)
// =============================================================
app.post("/send", async (req, res) => {
    const { title, message, icon, url } = req.body;

    const payload = {
        title: title || "Notificación",
        body: message || "Mensaje desde el servidor Push",
        icon: icon || "https://iappsweb.com/tu-proyecto-cupones/public/icon-192.png",
        url: url || "/"
    };

    const resultado = await enviarNotificacionATodos(payload);
    res.json(resultado);
});

// =============================================================
// 8) RUTA GET /send (para probar desde el navegador)
// =============================================================
app.get("/send", async (req, res) => {
    const title = req.query.title || "Test GET";
    const message = req.query.message || "Prueba de notificación GET";

    const payload = {
        title,
        body: message,
        icon: "https://iappsweb.com/tu-proyecto-cupones/public/icon-192.png",
        url: "/"
    };

    const resultado = await enviarNotificacionATodos(payload);
    res.json(resultado);
});

// =============================================================
// 9) LANZAR SERVIDOR (Render obliga a usar process.env.PORT)
// =============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
