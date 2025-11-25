import express from "express";
import cors from "cors";
import webpush from "web-push";
import config from "./config.js";

const app = express();
app.use(cors());
app.use(express.json());

// ==========================
//  CONFIGURAR VAPID
// ==========================

webpush.setVapidDetails(
  config.vapid.subject,
  config.vapid.publicKey,
  config.vapid.privateKey
);

// ==========================
//  RUTA RAÍZ (TEST)
// ==========================

app.get("/", (req, res) => {
  res.json({
    status: "Push Sender OK 🚀",
    port: process.env.PORT || 3000
  });
});

// ==========================
//  RUTA /send_push (GET -> test)
// ==========================

app.get("/send_push", (req, res) => {
  res.json({
    ok: true,
    message: "send_push GET OK (servidor listo para recibir POST)"
  });
});

// ==========================
//  RUTA /send_push (POST -> envío real desde Strato)
// ==========================

app.post("/send_push", async (req, res) => {
  const { secret, title, body, url, subscriptions } = req.body || {};

  console.log("POST /send_push recibido");
  console.log("Body:", JSON.stringify(req.body));

  // 1. Comprobar shared secret
  if (secret !== config.sharedSecret) {
    console.log("Secret incorrecto:", secret);
    return res.status(403).json({ error: "No autorizado (secret incorrecto)" });
  }

  // 2. Validar suscripciones
  if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
    console.log("Sin suscripciones válidas en el payload");
    return res.status(400).json({ error: "No hay suscripciones válidas en el payload" });
  }

  // 3. Payload de la notificación
  const payload = JSON.stringify({
  title: req.body.title,
  body: req.body.body,
  url:  req.body.url
  });


  // 4. Enviar notificación a cada suscripción
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

      console.log("Notificación enviada OK a:", s.endpoint);
      results.push({
        endpoint: s.endpoint,
        success: true,
        status: response.statusCode
      });

    } catch (error) {
  console.error("Error enviando push a:", s.endpoint);
  console.error("StatusCode:", error.statusCode);
  console.error("Response body:", error.body || error.message);

  results.push({
    endpoint: s.endpoint,
    success: false,
    statusCode: error.statusCode || null,
    body: error.body || null,
    reason: error.message
  });
}

  }

  return res.json({ ok: true, results });
});

// ==========================
//  CATCH-ALL PARA OTRAS RUTAS
// ==========================

app.all("*", (req, res) => {
  res.json({
    ok: false,
    message: "Ruta no definida en push-sender",
    method: req.method,
    path: req.path
  });
});

// ==========================
//  ARRANCAR SERVIDOR
// ==========================

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Push sender (web-push) running on port ${port}`);
});
