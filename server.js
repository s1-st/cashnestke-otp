const express = require("express");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const cors = require("cors");

const app = express();

// =========================
// MIDDLEWARE (IMPORTANT)
// =========================
app.use(cors());
app.use(express.json());

// =========================
// CONFIG (CHANGE THIS)
// =========================
const EMAIL_USER = "cashnest.verifycom@gmail.com";
const EMAIL_PASS = "iybo cecw pyvl amqw";

// =========================
// STORAGE (temporary memory)
// =========================
const otpStore = new Map();
const cooldownStore = new Map(); // anti-spam resend

// =========================
// HELPERS
// =========================
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});
    
}

// =========================
// SEND OTP
// =========================
app.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    // cooldown check (30 sec anti spam)
    const lastSent = cooldownStore.get(email);
    if (lastSent && Date.now() - lastSent < 30000) {
      return res.status(429).json({
        success: false,
        message: "Please wait 30 seconds before requesting OTP again",
      });
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min

    otpStore.set(email, { otp, expiresAt });
    cooldownStore.set(email, Date.now());

    const transporter = createTransporter();

    await transporter.sendMail({
      from: EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      html: `
        <div style="font-family:Arial">
          <h2>Your Verification Code</h2>
          <h1>${otp}</h1>
          <p>Valid for 5 minutes</p>
        </div>
      `,
    });

    return res.json({
      success: true,
      message: "OTP sent successfully",
    });

  } catch (err) {
    console.error("SEND OTP ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
});

// =========================
// RESEND OTP
// =========================
app.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;

    const existing = otpStore.get(email);

    if (!existing) {
      return res.status(400).json({
        success: false,
        message: "No previous OTP found. Please request a new one.",
      });
    }

    // reuse same OTP (safer + prevents spam emails)
    const transporter = createTransporter();

    await transporter.sendMail({
      from: EMAIL_USER,
      to: email,
      subject: "Your OTP Code (Resent)",
      html: `
        <div style="font-family:Arial">
          <h2>Your OTP (Resent)</h2>
          <h1>${existing.otp}</h1>
          <p>Valid until expiry</p>
        </div>
      `,
    });

    return res.json({
      success: true,
      message: "OTP resent successfully",
    });

  } catch (err) {
    console.error("RESEND ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to resend OTP",
    });
  }
});

// =========================
// VERIFY OTP
// =========================
app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  const record = otpStore.get(email);

  if (!record) {
    return res.status(400).json({
      success: false,
      message: "No OTP found",
    });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({
      success: false,
      message: "OTP expired",
    });
  }

  if (record.otp !== otp) {
    return res.status(400).json({
      success: false,
      message: "Invalid OTP",
    });
  }

  otpStore.delete(email);
  cooldownStore.delete(email);

  return res.json({
    success: true,
    message: "OTP verified successfully",
  });
});

// =========================
// CLEANUP OLD OTPs
// =========================
setInterval(() => {
  const now = Date.now();

  for (const [email, data] of otpStore.entries()) {
    if (data.expiresAt < now) {
      otpStore.delete(email);
    }
  }
}, 60 * 1000);

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("OTP server running on port", PORT);
});
