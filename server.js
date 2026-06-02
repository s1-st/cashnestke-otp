const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const { Resend } = require("resend");

const app = express();

app.use(cors());
app.use(express.json());

// =========================
// RESEND CONFIG
// =========================
const resend = new Resend("re_KuuEjVpJ_2ZdUzFQUup8U4tzmEzBeYZzG"); // 🔴 REPLACE THIS

const SENDER_EMAIL = "onboarding@resend.dev"; // works for testing

// =========================
// STORAGE
// =========================
const otpStore = new Map();
const cooldownStore = new Map();

// =========================
// OTP GENERATOR
// =========================
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

// =========================
// SEND OTP
// =========================
app.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email required"
      });
    }

    // anti-spam (30 sec cooldown)
    const last = cooldownStore.get(email);
    if (last && Date.now() - last < 30000) {
      return res.status(429).json({
        success: false,
        message: "Wait 30 seconds before requesting again"
      });
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    otpStore.set(email, { otp, expiresAt });
    cooldownStore.set(email, Date.now());

    await resend.emails.send({
      from: SENDER_EMAIL,
      to: email,
      subject: "Your OTP Code",
      html: `
        <div style="font-family:Arial">
          <h2>Your OTP Code</h2>
          <h1>${otp}</h1>
          <p>This code expires in 5 minutes</p>
        </div>
      `
    });

    return res.json({
      success: true,
      message: "OTP sent successfully"
    });

  } catch (err) {
    console.error("RESEND ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP"
    });
  }
});

// =========================
// RESEND OTP
// =========================
app.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;

    const record = otpStore.get(email);

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "No OTP found"
      });
    }

    await resend.emails.send({
      from: SENDER_EMAIL,
      to: email,
      subject: "Your OTP Code (Resent)",
      html: `
        <div style="font-family:Arial">
          <h2>Your OTP Code</h2>
          <h1>${record.otp}</h1>
          <p>Still valid</p>
        </div>
      `
    });

    return res.json({
      success: true,
      message: "OTP resent successfully"
    });

  } catch (err) {
    console.error("RESEND ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to resend OTP"
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
      message: "No OTP found"
    });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({
      success: false,
      message: "OTP expired"
    });
  }

  if (record.otp !== otp) {
    return res.status(400).json({
      success: false,
      message: "Invalid OTP"
    });
  }

  otpStore.delete(email);
  cooldownStore.delete(email);

  return res.json({
    success: true,
    message: "OTP verified successfully"
  });
});

// =========================
// CLEANUP
// =========================
setInterval(() => {
  const now = Date.now();

  for (const [email, data] of otpStore.entries()) {
    if (data.expiresAt < now) {
      otpStore.delete(email);
    }
  }
}, 60000);

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("OTP server running on port", PORT);
});
