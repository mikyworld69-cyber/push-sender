import express from "express";
import cors from "cors";
import webpush from "web-push";
import { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } from "./config.js";

console.log("PUBLIC KEY:", VAPID_PUBLIC_KEY);
console.log("PRIVATE KEY:", VAPID_PRIVATE_KEY);

webpush.setVapidDetails(
    "mailto:admin@iappsweb.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

const app = express();
app.use(cors());
app.use(express.json());

// Test
app.get("/", (req, res) => {
    res.send("PUSH SENDER ON");
});

app.listen(3000, () => console.log("Server running on port 3000"));
