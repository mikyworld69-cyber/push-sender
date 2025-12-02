// ======================================================
// CONFIG ES MODULE — Push Sender (Render)
// ======================================================

export default {
    vapid: {
        export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
        export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
        subject: "mailto:admin@iappsweb.com"
    },

    server: {
        port: process.env.PORT || 3000,
        host: "0.0.0.0"
    }
};
