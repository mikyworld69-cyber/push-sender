import express from "express";
import cors from "cors";
import webpush from "web-push";
import config from "./config.js";

const app = express();
app.use(cors());
app.use(express.json());

// Configurar VAPID
webpush.setVapidDetails(
  config.vapid.subject,
  config.vapid.publicKey,
  config.vapid.privateKey
);

// Test raíz
app.get("/", (req, res) => {
  res.json({ status: "Push Sender OK 🚀" });
});

// Test GET para /send_push (solo para comprobar ruta)
app.get("/send_push", (req, res) => {
  res.json({ ok: true, message: "send_push GET OK" });
});

// Endpoint real que usará Strato (POST)
app.post("/send_push", async (req, res) => {
  const { secret, title, body, url, subscriptions } = req.body;

  if (secret !== config.sharedSecret) {
    return res.status(403).json({ error: "No autorizado (secret incorrecto)" });
  }

  if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
    return res.status(400).json({ error: "No hay suscripciones válidas en el payload" });
  }

  const payload = JSON.stringify({
    title: title || "Notificación",
    body: body || "",
    url: url || "/"
  });

  const results = [];

  for (const s of subscriptions) {
    try {
      const response = await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: {
            p256dh: s.p256dh,
            auth: s.auth
          }
        },
        payload
      );

      results.push({
        endpoint: s.endpoint,
        success: true,
        status: response.statusCode
      });

    } catch (error) {
      results.push({
        endpoint: s.endpoint,
        success: false,
        reason: error.message
      });
    }
  }

  res.json({ ok: true, results });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Push sender running on port ${port}`);
});
