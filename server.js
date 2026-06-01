const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();

app.use(cors());
app.use(express.json());

let otpStore = {};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.post("/send-otp", async (req, res) => {

  const { email } = req.body;

  const otp = Math.floor(
    100000 + Math.random() * 900000
  ).toString();

  otpStore[email] = otp;

  try {

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Verification Code",
      text: `Your OTP code is ${otp}`
    });

    res.json({
      success: true
    });

  } catch (err) {

    res.status(500).json({
      success: false
    });

  }

});

app.post("/verify-otp", (req, res) => {

  const { email, otp } = req.body;

  if (otpStore[email] === otp) {

    delete otpStore[email];

    return res.json({
      success: true
    });

  }

  res.json({
    success: false
  });

});

app.listen(3000, () => {
  console.log("Running");
});
