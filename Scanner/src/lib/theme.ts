// High-contrast colours: results must read at a glance in a dark venue (FR-APP-10, NFR-25).
import type { RejectReason } from '@/api/types';

export const colors = {
  bg: '#0E1116',
  surface: '#1A1F27',
  border: '#2B323D',
  text: '#F4F6F8',
  muted: '#9AA4B2',
  primary: '#4C8DFF',
  accept: '#14A44D',
  reject: '#DC2F3C',
  warn: '#B7791F', // "not checked": no answer from the server, neither admit nor deny
};

// What gate staff see for each reject reason (FR-APP-14). Every reason must have a message.
export const rejectLabels: Record<RejectReason, string> = {
  INVALID: 'Not a valid ticket',
  ALREADY_USED: 'Ticket already used',
  REFUNDED: 'Ticket was refunded',
  TRANSFERRED_AWAY: 'Ticket was transferred to someone else',
  WRONG_EVENT: 'Ticket is for a different event',
  EVENT_CANCELLED: 'Ticket cancelled (event cancelled or ticket voided)',
};
