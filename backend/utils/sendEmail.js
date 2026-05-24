/**
 * utils/sendEmail.js
 *
 * Nodemailer utility — sends a single email via SMTP.
 *
 * Expects in .env:
 * SMTP_HOST     — e.g. smtp.gmail.com
 * SMTP_PORT     — e.g. 587
 * SMTP_EMAIL    — your sending address
 * SMTP_PASSWORD — app password (NOT your account password for Gmail)
 * FROM_NAME     — display name, e.g. "TrackWise"
 *
 * Usage:
 * await sendEmail({
 * email:   'user@example.com',
 * subject: 'Verify your email',
 * message: '<p>Click <a href="...">here</a></p>',
 * });
 */

const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  // Create a transporter — reused per call (not a persistent connection)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    // true for 465, false for other ports
    secure: parseInt(process.env.SMTP_PORT, 10) === 465,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
    family: 4, // ✦ THE MAGIC FIX: Forces IPv4 instead of IPv6 to prevent Render timeouts
  });

  const mailOptions = {
    from: `"${process.env.FROM_NAME || "TrackWise"}" <${process.env.SMTP_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    // Plain-text fallback for mail clients that block HTML
    text: options.message.replace(/<[^>]+>/g, ""),
    // Rich HTML body
    html: wrapInTemplate(options.subject, options.message),
  };

  await transporter.sendMail(mailOptions);
};

// ── Minimal branded HTML wrapper ─────────────────────────────────────────────
// Keeps emails readable and on-brand without an external template engine.
const wrapInTemplate = (subject, body) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden;">
        <tr>
          <td style="background:#0f172a;padding:28px 40px;text-align:center;">
            <span style="color:#10b981;font-size:22px;font-weight:800;
                         letter-spacing:-0.5px;">TrackWise</span>
            <span style="color:#64748b;font-size:12px;display:block;
                         margin-top:4px;text-transform:uppercase;
                         letter-spacing:2px;">Smart Expense Tracker</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;color:#1e293b;font-size:15px;
                     line-height:1.7;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="background:#f1f5f9;padding:20px 40px;
                     text-align:center;font-size:12px;color:#94a3b8;">
            If you did not create a TrackWise account, you can safely ignore
            this email.<br/>
            &copy; ${new Date().getFullYear()} TrackWise. All rights reserved.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

module.exports = sendEmail;
