// ===============================================
// PUSH SENDER — ES MODULE VERSION (Render Node 22)
// ===============================================

import express from "express";
import webpush from "web-push";
import mysql from "mysql2/promise";
import config from "./config.js";

// Crear app Express
const app = express();
app.use(express.json());

// ==========================
// CONFIG VAPID
// ==========================
webpush.setVapidDetails(
    config.vapid.subject,
    config.vapid.publicKey,
    config.vapid.privateKey
);

// ==========================
// POOL DE CONEXIÓN A MySQL
// ==========================
const db = await mysql.createPool({
    host: "database-5018992042.webspace-host.com",
    user: "dbu4029641",
    password: "********",   // pon tu password real
    database: "dbs14956516"
});

// ==========================
// ENDPOINT /send
// ==========================
app.get("/send", async (req, res) => {
    try {
        const [subs] = await db.query("SELECT * FROM push_subscriptions");

        if (subs.length === 0) {
            return res.json({ ok: true, enviados: 0, msg: "No hay suscriptores" });
        }

        const payload = JSON.stringify({
            title: req.query.titulo || "Notificación",
            body: req.query.mensaje || "Hola Mike 👋",
            icon: "/tu-proyecto-cupones/public/icon-192.png",
            url: "/tu-proyecto-cupones/public/panel_usuario.php"
        });

        const resultados = [];

        // Enviar push a cada suscripción
        for (const s of subs) {
            try {
                await webpush.sendNotification(
                    {
                        endpoint: s.endpoint,
                        keys: {
                            auth: s.auth,
                            p256dh: s.p256dh
                        }
                    },
                    payload
                );

                resultados.push({ endpoint: s.endpoint, ok: true });

            } catch (err) {
                resultados.push({
                    endpoint: s.endpoint,
                    ok: false,
                    error: err.body
                });

                // Si está caducada → borrarla
                await db.query("DELETE FROM push_subscriptions WHERE id = ?", [s.id]);
            }
        }

        res.json({
            ok: true,
            enviados: resultados.length,
            resultados
        });

    } catch (e) {
        res.json({ ok: false, error: e.message });
    }
});

// ==========================
// INICIAR SERVIDOR
// ==========================
app.listen(config.server.port, () => {
    console.log("Push Sender activo en puerto:", config.server.port);
});
