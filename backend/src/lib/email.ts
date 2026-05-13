import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.EMAIL_FROM || 'DivideEtCollabora <noreply@divideetcollabora.app>';

export async function sendExpenseNotification(
  toEmail: string,
  toName: string,
  fromName: string,
  groupName: string,
  description: string,
  amount: number,
  currency: string,
  userShare: number
) {
  if (!process.env.SMTP_USER) return; // skip if not configured
  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: `${fromName} ha aggiunto una spesa in "${groupName}"`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#10B981">DivideEtCollabora</h2>
        <p>Ciao ${toName},</p>
        <p><strong>${fromName}</strong> ha aggiunto <strong>${description}</strong> (${currency} ${amount.toFixed(2)}) nel gruppo <strong>${groupName}</strong>.</p>
        <p>La tua quota: <strong style="color:#EF4444">${currency} ${userShare.toFixed(2)}</strong></p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="background:#10B981;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:12px">Apri l'app</a>
      </div>
    `,
  });
}

export async function sendSettlementNotification(
  toEmail: string,
  toName: string,
  fromName: string,
  amount: number,
  currency: string
) {
  if (!process.env.SMTP_USER) return;
  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: `${fromName} ti ha pagato ${currency} ${amount.toFixed(2)}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#10B981">DivideEtCollabora</h2>
        <p>Ciao ${toName},</p>
        <p><strong>${fromName}</strong> ti ha pagato <strong style="color:#10B981">${currency} ${amount.toFixed(2)}</strong>.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="background:#10B981;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:12px">Apri l'app</a>
      </div>
    `,
  });
}

export async function sendPlatformInvite(
  toEmail: string,
  inviterName: string,
  customMessage?: string
) {
  if (!process.env.SMTP_USER) return;
  const url = process.env.FRONTEND_URL || 'http://localhost:5173';
  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: `${inviterName} ti invita su DivideEtCollabora`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
        <div style="background:#10B981;padding:32px 24px;text-align:center">
          <h1 style="color:white;margin:0;font-size:24px">DivideEtCollabora</h1>
          <p style="color:#d1fae5;margin:8px 0 0">Dividi le spese, non i rapporti</p>
        </div>
        <div style="padding:32px 24px">
          <p style="font-size:16px;color:#111827"><strong>${inviterName}</strong> ti ha invitato a unirsi a <strong>DivideEtCollabora</strong>, l'app per gestire le spese condivise con amici e colleghi.</p>
          ${customMessage ? `<div style="background:#f9fafb;border-left:4px solid #10B981;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0"><p style="margin:0;color:#374151;font-style:italic">"${customMessage}"</p></div>` : ''}
          <p style="color:#6b7280;font-size:14px">Con DivideEtCollabora puoi:</p>
          <ul style="color:#374151;font-size:14px;line-height:2">
            <li>Dividere spese in modo equo o personalizzato</li>
            <li>Tenere traccia di chi deve cosa a chi</li>
            <li>Saldare i debiti in pochi tap</li>
          </ul>
          <div style="text-align:center;margin:28px 0">
            <a href="${url}/register" style="background:#10B981;color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;display:inline-block">Registrati gratis</a>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center">Hai ricevuto questa email perché ${inviterName} ha inserito il tuo indirizzo. Se non vuoi ricevere altri inviti, ignorala.</p>
        </div>
      </div>
    `,
  });
}

export async function sendInviteNotification(
  toEmail: string,
  inviterName: string,
  groupName: string
) {
  if (!process.env.SMTP_USER) return;
  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: `${inviterName} ti ha invitato nel gruppo "${groupName}"`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#10B981">DivideEtCollabora</h2>
        <p><strong>${inviterName}</strong> ti ha invitato nel gruppo <strong>${groupName}</strong> su DivideEtCollabora.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="background:#10B981;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:12px">Unisciti ora</a>
      </div>
    `,
  });
}
