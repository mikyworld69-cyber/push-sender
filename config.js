// ===============================================
// CONFIGuración global del servicio Push Sender
// iAppsWeb · Render Node Service
// ===============================================

module.exports = {
    vapid: {
        publicKey: process.env.VAPID_PUBLIC,
        privateKey: process.env.VAPID_PRIVATE,
        subject: "mailto:admin@iappsweb.com"
    },

    server: {
        port: process.env.PORT || 3000,
        host: "0.0.0.0"
    }
};

