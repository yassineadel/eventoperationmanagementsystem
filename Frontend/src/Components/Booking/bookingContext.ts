import { createContext, useContext } from 'react'
import type { BookingAction, BookingError, BookingState } from './bookingModel'

export type BookingContextValue = {
  state: BookingState; now: number; names: Record<string, string>; storageAvailable: boolean;
  restoration: 'loading' | 'failed' | 'ready';
  retryRestore: () => void;
  act: (action: BookingAction) => BookingError | undefined;
  setAttendee: (key: string, name: string) => void
}
export const BookingContext = createContext<BookingContextValue | null>(null)
export function useBooking() {
  const value = useContext(BookingContext)
  if (!value) throw new Error('BookingProvider is required')
  return value
}
