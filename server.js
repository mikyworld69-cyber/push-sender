import express from "express";
import cors from "cors";
import webpush from "web-push";
import pkg from "pg";

const { Pool } = pkg;

// =============================================================
// 1) VAPID KEYS
// =============================================================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

console.log("PUBLIC KEY:", VAPID_PUBLIC_KEY);
console.log("PRIVATE KEY:", VAPID_PRIVATE_KEY);

webpush.setVapidDetails(
    "mailto:admin@iappsweb.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// =============================================================
// 2) POSTGRES PLANETSCALE
// =============================================================
console.log("DEBUG PG ENV:", {
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    pass: "***",
    db: process.env.DB_DATABASE
});

const db = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: 5432,
    ssl: { rejectUnauthorized: false }
});

db.connect()
    .then(() => console.log("PostgreSQL conectado ✔"))
    .catch(err => {
        console.error("❌ Error al conectar PG:", err);
        process.exit(1);
    });

// =============================================================
// 3) Funciones DB
// =============================================================
async function obtenerSuscripciones() {
    const res = await db.query("SELECT * FROM push_subs");
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

            // Eliminar suscripciones inválidas
            if (err.statusCode >= 400) {
                await db.query("DELETE FROM push_subs WHERE endpoint = $1", [s.endpoint]);
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
    res.send("Servidor Push funcionando ✔");
});

app.get("/send", async (req, res) => {
    const payload = {
        title: req.query.title || "Test Push",
        body: req.query.message || "Mensaje de prueba",
        icon: "https://iappsweb.com/tu-proyecto-cupones/public/icons/icon-192.png",
        url: "/"
    };

    const resultado = await enviarNotificacionATodos(payload);
    res.json(resultado);
});

app.post("/send", async (req, res) => {
    const payload = {
        title: req.body.title || "Notificación",
        body: req.body.message || "Mensaje del servidor Push",
        icon: req.body.icon || "https://iappsweb.com/tu-proyecto-cupones/public/icons/icon-192.png",
        url: req.body.url || "/"
    };

    const resultado = await enviarNotificacionATodos(payload);
    res.json(resultado);
});

// =============================================================
// 5) INICIAR SERVIDOR
// =============================================================
const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
    console.log("Servidor Push en puerto", PORT);
});
