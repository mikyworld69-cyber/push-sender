const express = require("express");
const webpush = require("web-push");
const mysql = require("mysql2/promise");
const config = require("./config");

const app = express();

app.use(express.json());

// ==========================
// CONFIG VAPID KEYS
// ==========================
webpush.setVapidDetails(
    config.vapid.subject,
    config.vapid.publicKey,
    config.vapid.privateKey
);

// ==========================
// CONEXIÓN A TU MISMA BD
// ==========================
const db = await mysql.createPool({
    host: "database-5018992042.webspace-host.com",
    user: "dbu4029641",
    password: "*******",
    database: "dbs14956516"
});

// ==========================
// ENDPOINT SEND
// ==========================
app.get("/send", async (req, res) => {
    try {
        // Leer suscriptores
        const [subs] = await db.query("SELECT * FROM push_subscriptions");

        if (subs.length === 0) {
            return res.json({ ok: true, enviados: 0, msg: "No hay suscriptores" });
        }

        const payload = JSON.stringify({
            title: req.query.titulo || "Notificación",
            body: req.query.mensaje || "Hola Mike",
            icon: "/tu-proyecto-cupones/public/icon-192.png",
            url: "/tu-proyecto-cupones/public/panel_usuario.php"
        });

        const resultados = [];

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

                // si falla → eliminar suscripción caducada
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
// ARRANCAR SERVIDOR
// ==========================
app.listen(config.server.port, () => {
    console.log("Push Sender listo en puerto", config.server.port);
});
