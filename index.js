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
  const { email, otp, context } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  try {
    const oauth2Client = getOAuth2Client();
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    let subject = 'Your Reminly OTP Verification Code';
    let htmlContent = '';
    let textContent = '';

    if (context === 'change_email_old') {
      subject = 'Security Verification: Change Email Request';
      htmlContent = `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: auto; padding: 32px; background-color: #121212; border-radius: 16px; color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #8B5CF6; margin: 0; font-size: 28px; letter-spacing: 1px;">Reminly</h1>
          </div>
          <div style="background-color: #1E1E2C; padding: 24px; border-radius: 12px; border: 1px solid #2D2D3F;">
            <h2 style="color: #ffffff; text-align: center; margin-top: 0;">Security Verification</h2>
            <p style="font-size: 16px; color: #D1D5DB; line-height: 1.6;">Hello,</p>
            <p style="font-size: 16px; color: #D1D5DB; line-height: 1.6;">For your security, we need to verify your identity before changing your email address. Your OTP code is:</p>
            <div style="text-align: center; margin: 32px 0;">
              <span style="display: inline-block; padding: 16px 32px; font-size: 32px; font-weight: 800; color: #ffffff; background: linear-gradient(135deg, #6C5DD3, #8B5CF6); border-radius: 8px; letter-spacing: 8px; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);">
                ${otp}
              </span>
            </div>
            <p style="font-size: 14px; color: #9CA3AF; line-height: 1.5; text-align: center;">This code is valid for 10 minutes.<br>If you did not request this change, please secure your account immediately.</p>
          </div>
          <p style="text-align: center; font-size: 12px; color: #6B7280; margin-top: 24px;">© ${new Date().getFullYear()} Reminly. All rights reserved.</p>
        </div>
      `;
      textContent = `Hello,\n\nFor your security, we need to verify your identity before changing your email address. Your OTP is: ${otp}\n\nThis code is valid for 10 minutes. If you did not request this, please secure your account immediately.\n\nReminly Support`;
    } else if (context === 'change_email_new') {
      subject = 'Verify Your New Email Address';
      htmlContent = `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: auto; padding: 32px; background-color: #121212; border-radius: 16px; color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #8B5CF6; margin: 0; font-size: 28px; letter-spacing: 1px;">Reminly</h1>
          </div>
          <div style="background-color: #1E1E2C; padding: 24px; border-radius: 12px; border: 1px solid #2D2D3F;">
            <h2 style="color: #ffffff; text-align: center; margin-top: 0;">Verify New Email</h2>
            <p style="font-size: 16px; color: #D1D5DB; line-height: 1.6;">Hello,</p>
            <p style="font-size: 16px; color: #D1D5DB; line-height: 1.6;">Please verify this new email address to complete your account update. Your OTP code is:</p>
            <div style="text-align: center; margin: 32px 0;">
              <span style="display: inline-block; padding: 16px 32px; font-size: 32px; font-weight: 800; color: #ffffff; background: linear-gradient(135deg, #6C5DD3, #8B5CF6); border-radius: 8px; letter-spacing: 8px; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);">
                ${otp}
              </span>
            </div>
            <p style="font-size: 14px; color: #9CA3AF; line-height: 1.5; text-align: center;">This code is valid for 10 minutes.<br>Do not share it with anyone.</p>
          </div>
          <p style="text-align: center; font-size: 12px; color: #6B7280; margin-top: 24px;">© ${new Date().getFullYear()} Reminly. All rights reserved.</p>
        </div>
      `;
      textContent = `Hello,\n\nPlease verify this new email address to complete your account update. Your OTP is: ${otp}\n\nThis code is valid for 10 minutes. Do not share it with anyone.\n\nReminly Support`;
    } else {
      subject = 'Your Reminly OTP Verification Code';
      htmlContent = `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: auto; padding: 32px; background-color: #121212; border-radius: 16px; color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #8B5CF6; margin: 0; font-size: 28px; letter-spacing: 1px;">Reminly</h1>
          </div>
          <div style="background-color: #1E1E2C; padding: 24px; border-radius: 12px; border: 1px solid #2D2D3F;">
            <h2 style="color: #ffffff; text-align: center; margin-top: 0;">Verification Code</h2>
            <p style="font-size: 16px; color: #D1D5DB; line-height: 1.6;">Hello,</p>
            <p style="font-size: 16px; color: #D1D5DB; line-height: 1.6;">Your One-Time Password (OTP) to securely access Reminly is:</p>
            <div style="text-align: center; margin: 32px 0;">
              <span style="display: inline-block; padding: 16px 32px; font-size: 32px; font-weight: 800; color: #ffffff; background: linear-gradient(135deg, #6C5DD3, #8B5CF6); border-radius: 8px; letter-spacing: 8px; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);">
                ${otp}
              </span>
            </div>
            <p style="font-size: 14px; color: #9CA3AF; line-height: 1.5; text-align: center;">This code is valid for 10 minutes.<br>Do not share it with anyone.</p>
          </div>
          <p style="text-align: center; font-size: 12px; color: #6B7280; margin-top: 24px;">© ${new Date().getFullYear()} Reminly. All rights reserved.</p>
        </div>
      `;
      textContent = `Hello,\n\nYour One-Time Password (OTP) for Reminly is: ${otp}\n\nThis code is valid for 10 minutes. Do not share it with anyone.\n\nReminly Support`;
    }

    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageId = `<${crypto.randomUUID()}@reminly.app>`;

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

app.post('/api/send-chat-notification', async (req, res) => {
  const { fcmToken, type, title, body, chatId, senderId, senderName } = req.body;

  if (!fcmToken || !type) {
    return res.status(400).json({ error: 'fcmToken and type are required' });
  }

  if (!admin.apps.length) {
    return res.status(500).json({ error: 'Firebase Admin not initialized.' });
  }

  try {
    let message = {
      token: fcmToken,
      data: {
        type: type, // 'typing' or 'message'
        chatId: chatId || '',
        senderId: senderId || '',
        senderName: senderName || ''
      }
    };

    if (type === 'message') {
      message.notification = {
        title: title || 'New Message',
        body: body || ''
      };
      message.android = {
        notification: {
          tag: `chat_${chatId}` // Replaces typing notification
        }
      };
      message.apns = {
        payload: {
          aps: {
            'thread-id': `chat_${chatId}`
          }
        }
      };
    } else if (type === 'typing') {
      message.notification = {
        title: senderName || 'Someone',
        body: 'is typing...'
      };
      message.android = {
        notification: {
          tag: `chat_${chatId}` // Group/tag to replace easily
        }
      };
      message.apns = {
        payload: {
          aps: {
            'thread-id': `chat_${chatId}`
          }
        }
      };
    }

    await admin.messaging().send(message);
    return res.status(200).json({ message: 'Notification sent securely' });
  } catch (error) {
    console.error("Error sending FCM:", error);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
});

app.post('/api/update-email', async (req, res) => {
  const { idToken, newEmail } = req.body;

  if (!idToken || !newEmail) {
    return res.status(400).json({ error: 'idToken and newEmail are required' });
  }

  if (!admin.apps.length) {
    return res.status(500).json({ error: 'Firebase Admin not initialized.' });
  }

  try {
    // 1. Verify the user's ID token to ensure they are authenticated
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 2. Update the user's email using Admin SDK
    // This updates the email instantly without sending a Firebase verification link.
    const userRecord = await admin.auth().updateUser(uid, {
      email: newEmail,
      emailVerified: true // Since we already verified it with our custom OTP
    });

    return res.status(200).json({ message: 'Email updated successfully', uid: userRecord.uid });
  } catch (error) {
    console.error("Error updating email:", error);
    return res.status(500).json({ error: 'Failed to update email' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
