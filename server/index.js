const express     = require("express");
const nodemailer  = require("nodemailer");
const cors        = require("cors");
const rateLimit   = require("express-rate-limit");

const app = express();
app.use(express.json({ limit: "256kb" }));
app.use(cors({ origin: process.env.FRONTEND_URL || "https://studentshifts.onrender.com" }));

// 30 emails per minute max
app.use("/send-email", rateLimit({ windowMs: 60_000, max: 30 }));

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

app.post("/send-email", async (req, res) => {
  // Simple API key check
  const key = req.headers["x-api-key"];
  if (!key || key !== process.env.EMAIL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { to, subject, html } = req.body;
  if (!to || !subject || !html) {
    return res.status(400).json({ error: "Missing to, subject, or html" });
  }

  try {
    await transporter.sendMail({
      from:    process.env.SMTP_FROM,
      to:      Array.isArray(to) ? to.join(", ") : to,
      subject,
      html,
    });
    res.json({ success: true });
  } catch (e) {
    console.error("Email error:", e.message);
    res.status(500).json({ error: "Failed to send email" });
  }
});

app.get("/health", (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Email server running on port ${PORT}`));
