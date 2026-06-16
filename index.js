require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    console.warn("FIREBASE_SERVICE_ACCOUNT env var is missing. Password reset won't work.");
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
}

const OAuth2 = google.auth.OAuth2;

const getOAuth2Client = () => {
  const oauth2Client = new OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.REFRESH_TOKEN
  });

  return oauth2Client;
};

app.post('/api/send-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  try {
    const oauth2Client = getOAuth2Client();
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const subject = 'Your Reminly OTP Verification Code';
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageId = `<${crypto.randomUUID()}@reminly.app>`;
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #4F46E5; text-align: center;">Reminly Verification</h2>
          <p style="font-size: 16px; color: #333;">Hello,</p>
          <p style="font-size: 16px; color: #333;">Your One-Time Password (OTP) for Reminly is:</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="display: inline-block; padding: 10px 20px; font-size: 24px; font-weight: bold; color: #fff; background-color: #4F46E5; border-radius: 5px; letter-spacing: 5px;">
              ${otp}
            </span>
          </div>
          <p style="font-size: 14px; color: #666;">This code is valid for 10 minutes. Do not share it with anyone.</p>
        </div>
    `;

    const textContent = `Hello,\n\nYour One-Time Password (OTP) for Reminly is: ${otp}\n\nThis code is valid for 10 minutes. Do not share it with anyone.\n\nReminly Support`;

    const messageParts = [
      `From: "Reminly Support" <${process.env.EMAIL_USER}>`,
      `To: ${email}`,
      `Subject: ${utf8Subject}`,
      `Message-ID: ${messageId}`,
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="boundary-string"',
      '',
      '--boundary-string',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      textContent,
      '',
      '--boundary-string',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      htmlContent,
      '--boundary-string--'
    ];

    const message = messageParts.join('\n');
    
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return res.status(200).json({ message: 'OTP sent successfully via Gmail API' });
  } catch (error) {
    console.error("Error sending email: ", error);
    return res.status(500).json({ error: 'Failed to send OTP email' });
  }
});

app.post('/api/send-reset-link', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!admin.apps.length) {
    return res.status(500).json({ error: 'Firebase Admin not initialized. Please configure FIREBASE_SERVICE_ACCOUNT.' });
  }

  try {
    const resetLink = await admin.auth().generatePasswordResetLink(email);

    const oauth2Client = getOAuth2Client();
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const subject = 'Reset Your Reminly Password';
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageId = `<${crypto.randomUUID()}@reminly.app>`;
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #4F46E5; text-align: center; margin-bottom: 24px;">Reset Your Password</h2>
          <p style="font-size: 16px; color: #4b5563; line-height: 1.5;">Hello,</p>
          <p style="font-size: 16px; color: #4b5563; line-height: 1.5;">We received a request to reset the password for your Reminly account. Click the button below to securely set a new password:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: bold; color: #ffffff; background-color: #4F46E5; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">
              Reset My Password
            </a>
          </div>
          <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">The Reminly Team</p>
        </div>
    `;

    const textContent = `Hello,\n\nWe received a request to reset the password for your Reminly account.\nPlease click the following link to securely set a new password:\n\n${resetLink}\n\nIf you didn't request a password reset, you can safely ignore this email.\n\nThe Reminly Team`;

    const messageParts = [
      `From: "Reminly Support" <${process.env.EMAIL_USER}>`,
      `To: ${email}`,
      `Subject: ${utf8Subject}`,
      `Message-ID: ${messageId}`,
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="boundary-string-reset"',
      '',
      '--boundary-string-reset',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      textContent,
      '',
      '--boundary-string-reset',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      htmlContent,
      '--boundary-string-reset--'
    ];

    const message = messageParts.join('\n');
    
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return res.status(200).json({ message: 'Password reset email sent securely' });
  } catch (error) {
    console.error("Error generating or sending reset link:", error);
    return res.status(500).json({ error: 'Failed to send password reset email' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
