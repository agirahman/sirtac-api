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
  const verificationLink = `http://localhost:3000/verification-success?token=${token}`;

  const html = `
      <!DOCTYPE html>
<html lang="en">
<head>
    <style>
        html, body {
            height: 100%;
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #f4f4f4;
        }
        .container {
            text-align: center;
            background-color: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-width: 400px;
            width: 100%;
        }
        .logo {
            height: 60px;
            margin: 0 auto 20px;
        }
        .verify-btn {
            background-color: #ff1493;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            transition: background-color 0.3s ease;
            text-decoration: none;
        }
        .verify-btn:hover {
            background-color: #ff69b4;
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
            text-align: center;
        }
        p {
            color: #666;
            line-height: 1.6;
            margin-bottom: 30px;
            text-align: center;
        }
        a {
            
        }      
    </style>
</head>
<body>
    <div class="container">
        <img src="https://i.imgur.com/nGN6b88.png" alt="Logo" class="logo">
        <h1>Verify Email Address</h1>
        <p>You're receiving this email because you recently created a new account. Please verify your email address by clicking the button below.</p>
        <a class="verify-btn" href = "${verificationLink}">VERIFY EMAIL</a>
    </div>
</body>
</html>
    `;

  await sendEmail({
    to: email,
    subject: "Verify Your Email",
    html,
  });
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetLink = `http://localhost:3000/reset-password?token=${token}`;

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

export const sendContactFormEmail = async (
  recipientEmail: string,
  name: string,
  email: string,
  message: string
): Promise<void> => {
  // Create HTML for the email
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        h1 {
          color: #006fee;
          margin-bottom: 20px;
        }
        .field {
          margin-bottom: 15px;
        }
        .label {
          font-weight: bold;
          margin-bottom: 5px;
        }
        .comment {
          background-color: #f9f9f9;
          padding: 15px;
          border-radius: 4px;
          white-space: pre-wrap;
        }
        .reply-btn {
          padding: 10px 20px;
          border-radius: 4px;
          display: inline-block;
          margin-top: 15px;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>New Contact Form Submission</h1>
        
        <div class="field">
          <div class="label">Name:</div>
          <div>${name}</div>
        </div>
        
        <div class="field">
          <div class="label">Email:</div>
          <div>${email}</div>
        </div>
        
        <div class="field">
          <div class="label">Comment:</div>
          <div class="comment">${message}</div>
        </div>
        
        <a href="mailto:${email}?subject=Re: Your Contact Form Submission" class="reply-btn">Reply to ${name}</a>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: recipientEmail,
    subject: `New Contact Form Message from ${name}`,
    html,
  });
};
