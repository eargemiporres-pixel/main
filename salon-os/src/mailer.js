/* Emails de la plataforma (recuperar contraseña, invitaciones). Se envían con
   Resend si el servidor tiene RESEND_API_KEY y MAIL_FROM; si no, la función
   devuelve { sent: false } y la interfaz ofrece otra salida. */

export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

export async function sendPlatformEmail({ to, subject, text }) {
  if (!mailConfigured()) return { sent: false, reason: 'not_configured' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text })
    });
    if (!res.ok) return { sent: false, reason: `http_${res.status}` };
    return { sent: true };
  } catch {
    return { sent: false, reason: 'network' };
  }
}
