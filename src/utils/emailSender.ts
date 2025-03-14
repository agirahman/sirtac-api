import nodemailer from "nodemailer";

// Buat interface biar lebih clean
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

// Buat reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.example.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true untuk port 465, false untuk lainnya
  auth: {
    user: process.env.SMTP_USER || "your-email@example.com",
    pass: process.env.SMTP_PASS || "your-email-password",
  },
});

// Fungsi kirim email utama
export const sendEmail = async ({ to, subject, html }: EmailOptions) => {
  const mailOptions = {
    from: process.env.SMTP_FROM || "noreply@example.com",
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
  } catch (error) {
    console.error(`Failed to send email: ${(error as Error).message}`);
    throw new Error("Failed to send email");
  }
};

// Helper buat email verifikasi (bisa ditambah untuk email lain)
export const sendVerificationEmail = async (email: string, token: string) => {
  const verificationLink = `http://localhost:5000/user/verify-email?token=${token}`;

  const html = `
        <h1>Email Verification</h1>
        <p>Please click the link below to verify your email:</p>
        <a href="${verificationLink}">Verify Email</a>
    `;

  await sendEmail({
    to: email,
    subject: "Verify Your Email",
    html,
  });
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetLink = `http://localhost:5000/user/reset-password?token=${token}`;

  const html = `
        <h1>Reset Your Password</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
    `;

  await sendEmail({
    to: email,
    subject: "Reset Your Password",
    html,
  });
};
