// ======================================================
// CONFIG ES MODULE — Push Sender (Render)
// ======================================================

export default {
    vapid: {
        publicKey: process.env.VAPID_PUBLIC?.trim() || "",
        privateKey: process.env.VAPID_PRIVATE?.trim() || "",
        subject: "mailto:admin@iappsweb.com"
    },

    server: {
        port: process.env.PORT || 3000,
        host: "0.0.0.0"
    }
};
