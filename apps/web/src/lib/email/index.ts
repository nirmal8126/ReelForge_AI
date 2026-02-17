import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM || 'ReelForge AI <noreply@reelforge.ai>'

export async function sendWelcomeEmail(email: string, name: string) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Welcome to ReelForge AI!',
    html: welcomeTemplate(name),
  })
}

export async function sendReelCompletedEmail(email: string, name: string, reelTitle: string, reelUrl: string) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your reel "${reelTitle}" is ready!`,
    html: reelCompletedTemplate(name, reelTitle, reelUrl),
  })
}

export async function sendReelFailedEmail(email: string, name: string, reelTitle: string) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Reel generation failed: "${reelTitle}"`,
    html: reelFailedTemplate(name, reelTitle),
  })
}

export async function sendUsageAlertEmail(email: string, name: string, used: number, limit: number) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Usage Alert: ${Math.round((used / limit) * 100)}% of your monthly reels used`,
    html: usageAlertTemplate(name, used, limit),
  })
}

export async function sendReferralEmail(email: string, name: string, referredName: string, credits: number) {
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `You earned ${credits} credits from a referral!`,
    html: referralTemplate(name, referredName, credits),
  })
}

export async function sendCampaignEmail(
  email: string,
  subject: string,
  htmlBody: string,
  recipientId: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const trackingPixel = `<img src="${appUrl}/api/email/track/${recipientId}" width="1" height="1" style="display:none;" alt="" />`

  return resend.emails.send({
    from: FROM,
    to: email,
    subject,
    html: baseTemplate(htmlBody + trackingPixel),
  })
}

// ---- Templates ----

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
</html>`
}

function welcomeTemplate(name: string) {
  return baseTemplate(`
    <h1 style="color:white;font-size:24px;margin:0 0 16px;">Welcome to ReelForge AI, ${name}!</h1>
    <p style="color:#9CA3AF;font-size:14px;line-height:1.6;">You're all set to start creating AI-powered video reels. Here's what you can do:</p>
    <ul style="color:#D1D5DB;font-size:14px;line-height:2;padding-left:20px;">
      <li>Create your first reel with our AI wizard</li>
      <li>Set up a channel profile for brand consistency</li>
      <li>Invite friends and earn free credits</li>
    </ul>
    <div style="text-align:center;margin-top:24px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/reels/new" style="display:inline-block;background-color:#6366F1;color:white;font-weight:600;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;">Create Your First Reel</a>
    </div>
    <p style="color:#6B7280;font-size:13px;margin-top:24px;">You have <strong style="color:#6366F1;">3 free reels</strong> to get started. No credit card required.</p>
  `)
}

function reelCompletedTemplate(name: string, title: string, url: string) {
  return baseTemplate(`
    <h1 style="color:white;font-size:24px;margin:0 0 16px;">Your reel is ready! 🎬</h1>
    <p style="color:#9CA3AF;font-size:14px;">Hi ${name}, your reel <strong style="color:white;">"${title}"</strong> has been generated successfully.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${url}" style="display:inline-block;background-color:#6366F1;color:white;font-weight:600;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;">View & Download Reel</a>
    </div>
    <p style="color:#6B7280;font-size:13px;">You can also find all your reels in your <a href="${process.env.NEXT_PUBLIC_APP_URL}/reels" style="color:#6366F1;">reel library</a>.</p>
  `)
}

function reelFailedTemplate(name: string, title: string) {
  return baseTemplate(`
    <h1 style="color:white;font-size:24px;margin:0 0 16px;">Reel Generation Failed</h1>
    <p style="color:#9CA3AF;font-size:14px;">Hi ${name}, we were unable to generate your reel <strong style="color:white;">"${title}"</strong>.</p>
    <p style="color:#9CA3AF;font-size:14px;">This can happen due to high demand or content filtering. Your credit has been refunded.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/reels/new" style="display:inline-block;background-color:#6366F1;color:white;font-weight:600;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;">Try Again</a>
    </div>
  `)
}

function usageAlertTemplate(name: string, used: number, limit: number) {
  const percent = Math.round((used / limit) * 100)
  return baseTemplate(`
    <h1 style="color:white;font-size:24px;margin:0 0 16px;">Usage Alert: ${percent}%</h1>
    <p style="color:#9CA3AF;font-size:14px;">Hi ${name}, you've used <strong style="color:white;">${used} of ${limit}</strong> reels this billing period.</p>
    <div style="background-color:rgba(255,255,255,0.1);border-radius:8px;height:8px;margin:20px 0;">
      <div style="background-color:${percent >= 90 ? '#EF4444' : '#6366F1'};border-radius:8px;height:8px;width:${percent}%;"></div>
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/billing" style="display:inline-block;background-color:#6366F1;color:white;font-weight:600;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;">Upgrade Plan</a>
    </div>
  `)
}

function referralTemplate(name: string, referredName: string, credits: number) {
  return baseTemplate(`
    <h1 style="color:white;font-size:24px;margin:0 0 16px;">You Earned ${credits} Credits! 🎉</h1>
    <p style="color:#9CA3AF;font-size:14px;">Hi ${name}, <strong style="color:white;">${referredName}</strong> signed up using your referral link!</p>
    <p style="color:#9CA3AF;font-size:14px;margin-top:12px;">You've been awarded <strong style="color:#6366F1;">${credits} credits</strong> — that's ${credits} free reel generations.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/referrals" style="display:inline-block;background-color:#6366F1;color:white;font-weight:600;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;">View Referral Dashboard</a>
    </div>
  `)
}
