// High-contrast colours: results must read at a glance in a dark venue (FR-APP-10, NFR-25).
export const colors = {
  bg: '#0E1116',
  surface: '#1A1F27',
  border: '#2B323D',
  text: '#F4F6F8',
  muted: '#9AA4B2',
  primary: '#4C8DFF',
  accept: '#14A44D',
  reject: '#DC2F3C',
};

export const rejectLabels: Record<string, string> = {
  INVALID: 'Invalid ticket',
  ALREADY_USED: 'Already used',
  REFUNDED: 'Ticket refunded',
  TRANSFERRED_AWAY: 'Ticket transferred to someone else',
  WRONG_EVENT: 'Wrong event',
  EVENT_CANCELLED: 'Event cancelled',
};
