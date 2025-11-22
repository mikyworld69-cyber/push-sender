app.use(express.json());

// Test básico
app.get("/", (req, res) => {
  res.json({ status: "Push Sender OK 🚀" });
});

// Endpoint real que recibe datos desde Strato
app.post("/send_push", async (req, res) => {
  const { secret, title, body, url, subscriptions } = req.body;

  if (secret !== config.sharedSecret) {
    return res.status(403).json({ error: "No autorizado" });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return res.status(400).json({ error: "No hay suscripciones" });
  }

  const payload = JSON.stringify({
    title,
    body,
    url
  });

  const results = [];

  for (const s of subscriptions) {
    try {
      const response = await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth }
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
app.get("/send_push", (req, res) => {
  res.json({ ok: true, message: "send_push GET OK" });
});
