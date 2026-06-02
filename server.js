import express from "express";
import nodemailer from "nodemailer";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// In-memory store (safe per email, NOT global OTP)
const otpStore = new Map();

/**
 * Create fresh transporter EACH request (prevents SMTP reuse bugs)
 */
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

/**
 * Generate secure OTP
 */
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * SEND OTP
 */
app.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    // store per email (NOT global)
    otpStore.set(email, { otp, expiresAt });

    const transporter = createTransporter();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      html: `
        <h2>Your Verification Code</h2>
        <p><b>${otp}</b></p>
        <p>This code expires in 5 minutes.</p>
      `,
    });

    return res.json({ success: true, message: "OTP sent successfully" });

  } catch (error) {
    console.error("OTP SEND ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP. Try again later.",
    });
  }
});

/**
 * VERIFY OTP
 */
app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  const record = otpStore.get(email);

  if (!record) {
    return res.status(400).json({ success: false, message: "No OTP found" });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ success: false, message: "OTP expired" });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  otpStore.delete(email);

  return res.json({ success: true, message: "OTP verified" });
});

/**
 * CLEANUP OLD OTPs (prevents memory issues)
 */
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (data.expiresAt < now) {
      otpStore.delete(email);
    }
  }
}, 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
