import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { config } from '../config.js';
import { logger } from '../logger.js';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let client: SESv2Client | undefined;
const ses = () => (client ??= new SESv2Client({ region: config.AWS_REGION }));

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function renderHtml(title: string, lines: string[], cta?: { label: string; href: string }) {
  const body = lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#34222e">${l}</p>`).join('');
  const button = cta
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(cta.href)}" style="display:inline-block;background:#0c831f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">${escapeHtml(cta.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#fee9d7;padding:24px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fffbf7;border:1px solid #f9bf8f;border-radius:20px;padding:28px">
    <p style="margin:0 0 18px;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#7a6274">Spaceborn</p>
    <h1 style="margin:0 0 18px;font-size:22px;color:#34222e">${escapeHtml(title)}</h1>
    ${body}${button}
    <p style="margin:28px 0 0;font-size:12px;color:#7a6274">Electronics delivered in minutes from stores near you.</p>
  </div></body></html>`;
}

export const otpBlock = (otp: string) =>
  `<span style="display:inline-block;font-size:28px;letter-spacing:.35em;font-weight:800;color:#0c831f;background:#f2fcf4;border:1px dashed #0c831f;border-radius:12px;padding:10px 18px">${escapeHtml(otp)}</span>`;

export async function sendMail(mail: Mail): Promise<void> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.to)) {
    logger.warn({ to: mail.to, subject: mail.subject }, 'mail skipped: invalid recipient');
    return;
  }
  if (config.MAIL_PROVIDER !== 'ses' || !config.MAIL_FROM) {
    logger.info({ to: mail.to, subject: mail.subject, preview: mail.text.slice(0, 200) }, 'mail (log provider)');
    return;
  }
  try {
    await ses().send(
      new SendEmailCommand({
      FromEmailAddress: `Spaceborn <${config.MAIL_FROM}>`,
      Destination: { ToAddresses: [mail.to] },
      ConfigurationSetName: config.MAIL_CONFIGURATION_SET,
      Content: {
        Simple: {
          Subject: { Data: mail.subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: mail.text, Charset: 'UTF-8' },
            ...(mail.html ? { Html: { Data: mail.html, Charset: 'UTF-8' } } : {}),
          },
        },
        },
      }),
    );
    logger.info({ to: mail.to, subject: mail.subject }, 'mail sent');
  } catch (err) {
    // Sandbox rejections (unverified recipient) and bad addresses never succeed on retry.
    const name = (err as { name?: string }).name;
    if (name === 'MessageRejected' || name === 'BadRequestException') {
      logger.warn({ err, to: mail.to, subject: mail.subject }, 'mail rejected by SES');
      return;
    }
    throw err;
  }
}
