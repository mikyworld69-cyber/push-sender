// ===============================================
// CONFIG OFICIAL — WEB PUSH SENDER (Render)
// iAppsWeb · Cupones Fidelidad
// ===============================================

require("dotenv").config(); // por si usas .env localmente

// Validación preventiva: evita que Render arranque sin claves
if (!process.env.VAPID_PUBLIC || !process.env.VAPID_PRIVATE) {
    console.error("❌ ERROR: Las claves VAPID no están definidas en las variables de entorno.");
    console.error("Debe configurarse en Render:");
    console.error(" - VAPID_PUBLIC");
    console.error(" - VAPID_PRIVATE");
    process.exit(1);
}

module.exports = {
    vapid: {
        publicKey: process.env.VAPID_PUBLIC.trim(),
        privateKey: process.env.VAPID_PRIVATE.trim(),
        subject: "mailto:admin@iappsweb.com",
    },

    server: {
        port: process.env.PORT || 3000,
        host: "0.0.0.0",
    }
};
