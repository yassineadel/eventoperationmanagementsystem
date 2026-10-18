import nodemailer from 'nodemailer'
import QRCode from 'qrcode'
import prisma from '../../config/db'
import { env } from '../../config/env'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: env.MAIL_USER, pass: env.MAIL_PASS },
})

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const when = (d: Date) =>
  d.toLocaleString('en-GB', { timeZone: 'Africa/Cairo', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * The QR code drawn as a table of black and white cells. Gmail's apps show image attachments
 * below the message instead of inside it; a table always stays where it is put, and nothing
 * has to be downloaded or hosted.
 */
export const qrTable = (text: string, cell = 6) => {
  const { size, data } = QRCode.create(text, { errorCorrectionLevel: 'M' }).modules
  const quiet = 3
  const n = size + quiet * 2
  const dark = (r: number, c: number) =>
    r >= quiet && c >= quiet && r < size + quiet && c < size + quiet && data[(r - quiet) * size + (c - quiet)] === 1
  let rows = ''
  for (let r = 0; r < n; r++) {
    let cells = ''
    // join runs of the same colour into one cell to keep the email small
    for (let c = 0; c < n; ) {
      const d = dark(r, c)
      let run = 1
      while (c + run < n && dark(r, c + run) === d) run++
      cells += `<td${run > 1 ? ` colspan="${run}"` : ''} width="${run * cell}" bgcolor="${d ? '#000' : '#fff'}"></td>`
      c += run
    }
    rows += `<tr style="height:${cell}px">${cells}</tr>`
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="#ffffff" width="${n * cell}" style="border-collapse:collapse;background:#ffffff;margin:0 auto;font-size:0;line-height:0">${rows}</table>`
}

/**
 * Emails the current holder their ticket with its QR code (FR-MTK-05).
 * The QR is drawn inside the message (see qrTable), so it sits in the ticket in every mail client.
 */
export const sendTicketEmail = async (ticketId: string) => {
  const t = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    select: {
      qrToken: true, attendeeName: true,
      holder: { select: { email: true, fullName: true } },
      event: { select: { name: true, startAt: true, doorsOpenAt: true, venue: { select: { name: true, address: true, city: true } } } },
      ticketCategory: { select: { name: true } },
      seat: { select: { section: true, row: true, number: true } },
      orderItem: { select: { order: { select: { reference: true } } } },
    },
  })
  const qr = qrTable(t.qrToken)
  const seat = t.seat ? `, section ${t.seat.section}, row ${t.seat.row}, seat ${t.seat.number}` : ''
  const v = t.event.venue

  const brand = '#7a2e5c'
  const row = (label: string, value: string) => `
    <tr><td style="padding:6px 0;color:#8a8494;font-size:12px;text-transform:uppercase;letter-spacing:1px" width="38%">${label}</td>
        <td style="padding:6px 0;color:#1d1b26;font-size:15px;font-weight:bold">${value}</td></tr>`

  await transporter.sendMail({
    from: `"Hafletna" <${env.MAIL_USER}>`,
    to: t.holder.email,
    subject: `🎟 Your ticket for ${t.event.name}`,
    text: `${t.event.name}
${when(t.event.startAt)}
${v.name}, ${v.city}
${t.attendeeName} - ${t.ticketCategory.name}${seat}
Order ${t.orderItem.order.reference}
Open this email to see the QR code to show at the gate.`,
    html: `<!doctype html><html><head><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"></head>
<body style="margin:0;padding:0;background:#f5f3ef">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f5f3ef" style="background:#f5f3ef;padding:24px 12px">
 <tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;font-family:Arial,Helvetica,sans-serif">
   <tr><td bgcolor="${brand}" style="background:${brand};border-radius:16px 16px 0 0;padding:22px 24px">
     <div style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:-0.5px">hafletna</div>
     <div style="color:#f3d6e6;font-size:13px;margin-top:4px">Your e-ticket</div>
     <div style="color:#ffffff;font-size:24px;font-weight:bold;margin-top:14px;line-height:1.2">${esc(t.event.name)}</div>
   </td></tr>
   <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:20px 24px 4px">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row('Date', esc(when(t.event.startAt)))}
      ${row('Doors open', esc(when(t.event.doorsOpenAt).split(', ').pop()!))}
      ${row('Venue', `${esc(v.name)}<br><span style="font-weight:normal;color:#6b6878;font-size:13px">${esc(v.address)}, ${esc(v.city)}</span>`)}
      ${row('Name', esc(t.attendeeName))}
      ${row('Ticket', esc(t.ticketCategory.name))}
      ${t.seat ? row('Seat', `Section ${esc(t.seat.section)} · Row ${esc(t.seat.row)} · Seat ${t.seat.number}`) : ''}
     </table>
   </td></tr>
   <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px 24px"><div style="border-top:2px dashed #e4e0d8;height:1px;line-height:1px">&nbsp;</div></td></tr>
   <tr><td bgcolor="#ffffff" align="center" style="background:#ffffff;padding:12px 24px 8px">
     ${qr}
     <div style="color:#1d1b26;font-size:14px;font-weight:bold;margin-top:10px">Show this code at the gate</div>
     <div style="color:#8a8494;font-size:12px;margin-top:4px">Order ${esc(t.orderItem.order.reference)}</div>
   </td></tr>
   <tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:0 0 16px 16px;padding:12px 24px 22px">
     <div style="background:#fbf0d9;color:#8a5a00;font-size:12px;padding:10px 12px;border-radius:8px">Keep this code private. If the ticket is transferred to someone else, this code stops working.</div>
   </td></tr>
   <tr><td align="center" style="padding:16px;color:#8a8494;font-size:11px">Hafletna · Cairo, Egypt</td></tr>
  </table>
 </td></tr>
</table></body></html>`,
  })
}

/** After payment: one email per ticket. Failures are logged; the buyer can use "Email me" later. */
export const sendOrderTicketEmails = async (orderId: string) => {
  const tickets = await prisma.ticket.findMany({ where: { orderItem: { orderId } }, select: { id: true } })
  for (const { id } of tickets) {
    await sendTicketEmail(id).catch((e) => console.error(`Ticket email for ${id} failed:`, e.message))
  }
}
