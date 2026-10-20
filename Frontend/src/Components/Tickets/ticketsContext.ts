import { createContext, useContext } from 'react'
import type { Selection } from '../Booking/bookingModel'
import type { PaymentReceipt, TicketResult, WalletState } from './ticketsModel'

export type TicketsContextValue = {
  state: WalletState; now: number; storageAvailable: boolean;
  transferTicket: (id: string, email: string, confirmed: boolean) => TicketResult;
  requestRefund: (id: string, confirmed: boolean) => TicketResult;
  resendTicket: (id: string) => TicketResult;
  resetSamples: () => void;
  completeOrder: (receipt: PaymentReceipt, items: Selection[], names: Record<string, string>) => TicketResult;
}
export const TicketsContext = createContext<TicketsContextValue | null>(null)
export function useTickets() {
  const value = useContext(TicketsContext)
  if (!value) throw new Error('TicketsProvider is required')
  return value
}
