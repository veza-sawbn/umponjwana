import nodemailer from 'nodemailer'

// SERVER ONLY — only ever import from app/api/*/route.ts handlers.
//
// Sends mail via SMTP through the mailbox hosted at domains.co.za, instead
// of an ESP like Resend. We moved off Resend because domain verification
// needs an MX record on a sending subdomain, and the zone's nameservers
// (still Wix, even though mailboxes live at domains.co.za) don't support
// subdomain MX records. Plain SMTP auth against an existing mailbox needs
// no new DNS records at all.
//
// Required env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD.
// SMTP_SECURE defaults to true for port 465, false otherwise (STARTTLS).
// EMAIL_FROM defaults to the SMTP_USER mailbox.

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

/**
 * SMTP_HOST must be a bare hostname — nodemailer hands it straight to a DNS
 * lookup, so a pasted URL like "https://mail.example.com" fails with an
 * opaque `queryA EBADNAME`. Strip the scheme, any path, and a stray port
 * (SMTP_PORT governs that) so a copy-pasted webmail URL still works.
 */
function normaliseHost(raw: string): string {
  return raw
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')  // scheme
    .replace(/\/.*$/, '')                      // path
    .replace(/:\d+$/, '')                      // port
}

function getTransporter() {
  if (transporter) return transporter
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) return null

  const port = Number(SMTP_PORT)
  transporter = nodemailer.createTransport({
    host: normaliseHost(SMTP_HOST),
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  })
  return transporter
}

export async function sendMail(o: { to: string; subject: string; html: string }): Promise<{ sent: boolean; error: string | null }> {
  const t = getTransporter()
  if (!t) return { sent: false, error: 'SMTP not configured' }
  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || `Visit Drakensberg <${process.env.SMTP_USER}>`,
      to: o.to,
      subject: o.subject,
      html: o.html,
    })
    return { sent: true, error: null }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'send failed'
    // DNS failures almost always mean SMTP_HOST is wrong rather than the mail
    // server being down — say so, since the raw error names neither.
    if (/EBADNAME|ENOTFOUND|EAI_AGAIN/.test(message)) {
      return { sent: false, error: `${message} — check SMTP_HOST is a bare hostname (e.g. mail.example.com), not a URL` }
    }
    return { sent: false, error: message }
  }
}

// Programmatic sends bypass any signature configured in the mailbox's
// webmail client, so every template appends this footer itself.
export function emailSignature(): string {
  return `<div style="margin-top:28px;padding-top:20px;border-top:1px solid #eee;">
    <p style="font-size:13px;color:#444;margin:0 0 2px;">Warm regards,</p>
    <p style="font-size:13px;color:#1a1a1a;margin:0 0 12px;font-weight:bold;">The Visit Drakensberg Team</p>
    <p style="font-size:11px;color:#aaa;margin:0;line-height:1.6;">
      Visit Drakensberg · <a href="https://visitdrakensberg.co.za" style="color:#aaa;">visitdrakensberg.co.za</a><br/>
      This is an automated message — please do not reply directly to this email.
    </p>
  </div>`
}
