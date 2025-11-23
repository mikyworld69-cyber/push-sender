import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------
// RUTA PRINCIPAL DE TEST
// ------------------------------
app.get("/", (req, res) => {
  res.json({
    status: "Debug server OK",
    port: process.env.PORT || 3000
  });
});

// ------------------------------
// RUTA DE TEST PARA /send_push
// Acepta GET, POST, cualquier método.
// ------------------------------
app.all("/send_push", (req, res) => {
  res.json({
    ok: true,
    message: "send_push recibido correctamente",
    method: req.method,
    path: req.path,
    body: req.body || null
  });
});

// ------------------------------
// CATCH-ALL
// Responde a TODAS las rutas no definidas
// para evitar "Cannot GET /loquesea"
// ------------------------------
app.all("*", (req, res) => {
  res.json({
    ok: true,
    message: "Ruta genérica capturada",
    method: req.method,
    path: req.path
  });
});

// ------------------------------
// ARRANCAR SERVIDOR
// ------------------------------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`DEBUG Push sender running on port ${port}`);
});
