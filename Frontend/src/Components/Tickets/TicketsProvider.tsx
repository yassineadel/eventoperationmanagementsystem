import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Selection } from '../Booking/bookingModel'
import { TicketsContext } from './ticketsContext'
import { completeSampleOrder, createSampleWallet, readWallet, requestSampleRefund, resendSampleTicket, transferSampleTicket, writeWallet, type PaymentReceipt, type TicketResult, type WalletState } from './ticketsModel'

export default function TicketsProvider({ children, initialState }: { children: ReactNode; initialState?: WalletState }) {
  const [state, setState] = useState(() => initialState ?? readWallet())
  const current = useRef(state)
  const [now, setNow] = useState(Date.now)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const apply = useCallback((transition: (state: WalletState, now: number) => TicketResult & { state: WalletState }) => {
    const timestamp = Date.now()
    const result = transition(current.current, timestamp)
    if (result.state !== current.current) { current.current = result.state; setState(result.state); setStorageAvailable(writeWallet(result.state)) }
    setNow(timestamp)
    return { ok: result.ok, error: result.error, orderRef: result.orderRef }
  }, [])
  const completeOrder = useCallback((receipt: PaymentReceipt, items: Selection[], names: Record<string, string>) => apply((state, now) => completeSampleOrder(state, receipt, items, names, now)), [apply])
  const transferTicket = useCallback((id: string, email: string, confirmed: boolean) => apply((state, now) => transferSampleTicket(state, id, email, confirmed, now)), [apply])
  const requestRefund = useCallback((id: string, confirmed: boolean) => apply((state, now) => requestSampleRefund(state, id, confirmed, now)), [apply])
  const resendTicket = useCallback((id: string) => apply((state, now) => resendSampleTicket(state, id, now)), [apply])
  const resetSamples = useCallback(() => {
    const samples = createSampleWallet()
    const next = { tickets: [...current.current.tickets, ...samples.tickets.filter((ticket) => !current.current.tickets.some((item) => item.id === ticket.id))], orders: [...current.current.orders, ...samples.orders.filter((order) => !current.current.orders.some((item) => item.reference === order.reference))] }
    current.current = next; setState(next); setStorageAvailable(writeWallet(next)); setNow(Date.now())
  }, [])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer) }, [])
  return <TicketsContext.Provider value={{ state, now, storageAvailable, completeOrder, transferTicket, requestRefund, resendTicket, resetSamples }}>{children}</TicketsContext.Provider>
}
