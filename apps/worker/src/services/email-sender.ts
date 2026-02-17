import { Resend } from 'resend';
import { logger } from '../utils/logger';

let resend: Resend | null = null;

function getResend() {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM = process.env.EMAIL_FROM || 'ReelForge AI <noreply@reelforge.ai>';

function baseTemplate(content: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background-color:#6366F1;border-radius:12px;padding:12px 16px;">
        <span style="color:white;font-weight:bold;font-size:18px;">RF</span>
      </div>
      <p style="color:#6366F1;font-weight:600;font-size:16px;margin-top:8px;">ReelForge AI</p>
    </div>
    <div style="background-color:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:32px;">
      ${content}
    </div>
    <div style="text-align:center;margin-top:32px;">
      <p style="color:#6B7280;font-size:12px;">ReelForge AI &middot; AI-Powered Video Generation</p>
      <p style="color:#4B5563;font-size:11px;margin-top:4px;">You received this email because you have an account on ReelForge AI.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendSequenceEmail(
  email: string,
  subject: string,
  htmlBody: string
): Promise<boolean> {
  try {
    const r = getResend();
    await r.emails.send({
      from: FROM,
      to: email,
      subject,
      html: baseTemplate(htmlBody),
    });
    logger.info({ email, subject }, 'Sequence email sent');
    return true;
  } catch (err) {
    logger.error({ err, email, subject }, 'Failed to send sequence email');
    return false;
  }
}
