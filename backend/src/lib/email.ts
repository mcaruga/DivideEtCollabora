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
