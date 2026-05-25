/**
 * utils/sendEmail.js  (Production Fix — Resend API)
 *
 * Replaces Nodemailer + Gmail SMTP entirely.
 */

const { Resend } = require("resend");

// Initialise once — the client is stateless and safe to reuse
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (options) => {
  const from = `${process.env.FROM_NAME || "TrackWise"} <${process.env.FROM_EMAIL || "onboarding@resend.dev"}>`;

  const { data, error } = await resend.emails.send({
    from,
    to: [options.email], // Resend expects an array for 'to'
    subject: options.subject,
    html: wrapInTemplate(options.subject, options.message),
    text: options.message.replace(/<[^>]+>/g, ""), // plain-text fallback
  });

  // Resend returns an error object instead of throwing — normalise to a throw
  // so authController's try/catch blocks work identically to before
  if (error) {
    console.error("Resend error:", error);
    throw new Error(error.message || "Failed to send email via Resend.");
  }

  return data;
};

// ── Branded HTML email wrapper ─────────────────────────────────────────────────
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
                    box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden;
                    max-width:100%;">
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
            If you did not request this, you can safely ignore this email.<br/>
            &copy; ${new Date().getFullYear()} TrackWise. All rights reserved.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

module.exports = sendEmail;
