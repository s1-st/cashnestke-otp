const express = require("express");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const cors = require("cors");
app.use(cors());
app.use(express.json());
const app = express();
app.use(express.json());

/**
 * 👉 PUT YOUR EMAIL DETAILS HERE (IMPORTANT)
 */
const EMAIL_USER = "cashnest.verifycom@gmail.com";
const EMAIL_PASS = "iybo cecw pyvl amqw";

// OTP storage (temporary memory)
const otpStore = new Map();

/**
 * Generate OTP
 */
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Create mail transporter
 */
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
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

    otpStore.set(email, { otp, expiresAt });

    const transporter = createTransporter();

    await transporter.sendMail({
      from: EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      html: `
        <h2>Verification Code</h2>
        <h1>${otp}</h1>
        <p>This code expires in 5 minutes.</p>
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
      error: err.message,
    });
  }
});

/**
 * VERIFY OTP
 */
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

  return res.json({
    success: true,
    message: "OTP verified successfully",
  });
});

/**
 * Clean expired OTPs every minute
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

app.listen(PORT, () => {
  console.log("OTP server running on port", PORT);
});
