import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Ruta raíz
app.get("/", (req, res) => {
  res.json({ status: "Debug server OK", port: process.env.PORT || 3000 });
});

// Ruta para /send_push (GET y POST y todo lo que venga)
app.all("/send_push", (req, res) => {
  res.json({
    ok: true,
    message: "send_push recibido",
    method: req.method,
    path: req.path,
    body: req.body || null
  });
});

// Ruta catch-all para ver TODO lo que entra
app.all("*", (req, res) => {
  res.json({
    ok: true,
    message: "Ruta genérica",
    method: req.method,
    path: req.path
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`DEBUG Push sender running on port ${port}`);
});
