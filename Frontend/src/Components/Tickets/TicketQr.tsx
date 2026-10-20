import { useMemo } from 'react'
import qrcode from 'qrcode-generator'
import { usePreferences } from '../Auth/preferences'
import { useTickets } from './ticketsContext'
import { qrPayload, type SampleTicket } from './ticketsModel'

export default function TicketQr({ ticket }: { ticket: SampleTicket }) {
  const { lang } = usePreferences()
  const { now } = useTickets()
  const payload = qrPayload(ticket, now)
  const matrix = useMemo(() => {
    if (!payload) return null
    const code = qrcode(0, 'M')
    code.addData(payload, 'Byte')
    code.make()
    const size = code.getModuleCount()
    let path = ''
    for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
      if (code.isDark(row, column)) path += `M${column + 4},${row + 4}h1v1h-1z`
    }
    return { size: size + 8, path }
  }, [payload])
  if (!matrix) return null
  return <svg className="tickets-qr-svg" role="img" aria-label={lang === 'ar' ? 'رمز QR تجريبي، غير صالح للدخول' : 'Sample QR code, not valid for admission'} viewBox={`0 0 ${matrix.size} ${matrix.size}`} width="248" height="248" shapeRendering="crispEdges"><rect width={matrix.size} height={matrix.size} fill="#fff" /><path d={matrix.path} fill="#090c20" /></svg>
}
