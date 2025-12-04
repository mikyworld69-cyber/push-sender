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

// Validación
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
// 2) EXPRESS
// =============================================================
const app = express();
app.use(cors());
app.use(express.json());

// =============================================================
// 3) POSTGRES PLANETSCALE
// =============================================================
const db = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: false }
});

async function checkDB() {
    try {
        await db.query("SELECT NOW()");
        console.log("PostgreSQL conectado ✔");
    } catch (err) {
        console.error("❌ Error al conectar a PostgreSQL", err);
        process.exit(1);
    }
}

// =============================================================
// 4) FUNCIONES DB
// =============================================================
async function obtenerSuscripciones() {
    const q = `SELECT id, endpoint, p256dh, auth FROM push_subs ORDER BY id DESC;`;
    const { rows } = await db.query(q);
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
                    keys: { p256dh: s.p256dh, auth: s.auth }
                },
                JSON.stringify(payload)
            );

            resultados.push({
                endpoint: s.endpoint,
                http: result.statusCode,
                success: result.statusCode >= 200
            });

        } catch (err) {
            resultados.push({
                endpoint: s.endpoint,
                http: err.statusCode || 0,
                success: false,
                raw: err.body || String(err)
            });

            // borrar suscripciones inválidas
            if (err.statusCode >= 400) {
                await db.query("DELETE FROM push_subs WHERE endpoint = $1", [s.endpoint]);
            }
        }
    }

    return {
        enviados: subs.length,
        resultados
    };
}

// =============================================================
// 5) RUTAS
// =============================================================
app.get("/", (req, res) => {
    res.json({ ok: true, msg: "Push Server activo con PostgreSQL" });
});

app.get("/send", async (req, res) => {
    const payload = {
        title: req.query.title || "Título por defecto",
        body: req.query.message || "Mensaje por defecto",
        icon: "https://iappsweb.com/tu-proyecto-cupones/public/icon-192.png",
        url: "/",
    };

    const resultado = await enviarNotificacionATodos(payload);
    res.json(resultado);
});

// =============================================================
// 6) INICIAR SERVIDOR
// =============================================================
async function iniciar() {
    await checkDB();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, "0.0.0.0", () => {
        console.log("Servidor Push en puerto", PORT);
    });
}

iniciar();
