import express from "express";
import webpush from "web-push";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const vapidKeys = {
  publicKey: "BGYyjAQ_XU8zUtLjRJ2QOz0CpkSJTELs_vX-miTBA-geDih7D8id9GC1C487J6Sqx912kRO7fJtSJHMpUzFMNJk",
  privateKey: "oFfzvXBiOAzWR8_bCX6elcL9XtGPK46OgP9BdONu0_w"
};

webpush.setVapidDetails(
  "mailto:info@iappsweb.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

app.post("/send_push", async (req, res) => {
  const { secret, title, body, url, subscriptions } = req.body;

  if (secret !== "43534534gdggr5646487867gfghff") {
    return res.status(403).json({ error: "Invalid secret" });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return res.json({ ok: false, msg: "No subscriptions" });
  }

  const payload = JSON.stringify({ title, body, url });
  const results = []; // <<-- ESTO EVITA EL ERROR

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      results.push({ endpoint: sub.endpoint, success: true });
    } catch (err) {
      results.push({
        endpoint: sub.endpoint,
        success: false,
        error: err.message
      });
    }
  }

  res.json({ ok: true, results });
});

app.listen(10000, () => {
  console.log("Servidor push escuchando en puerto 10000");
});
