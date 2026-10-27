// Fake gate API so the screens can be built before the backend gate module exists.
// Swap it for the real one in src/api/index.ts later; screens do not change.
//
// Test login:  username "staff"  password "1234"
// Test QR codes (make them at any QR generator site):
//   HAF-0001 .. HAF-0005  valid tickets for "Cairo Jazz Night"
//   HAF-0006              refunded
//   HAF-0007              transferred away
//   HAF-0101              valid, but for the other event (wrong event)
//   anything else         invalid

import type { GateApi, GateEvent, Guest, RejectReason, ScanResponse } from './types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const EVENTS: GateEvent[] = [
  { id: 'evt-1', name: 'Cairo Jazz Night', venueName: 'Cairo Opera House - Small Hall', startAt: '2026-11-20T19:00:00Z', seated: true },
  { id: 'evt-2', name: 'Summer Beats', venueName: 'Al Manara Arena', startAt: '2026-11-28T20:00:00Z', seated: false },
];

type MockTicket = Guest & { code: string; eventId: string; status: 'VALID' | 'USED' | 'REFUNDED' | 'TRANSFERRED' };

const TICKETS: MockTicket[] = [
  { code: 'HAF-0001', ticketId: 't1', eventId: 'evt-1', attendeeName: 'Ahmed Ali', category: 'VIP', seat: 'A-4', status: 'VALID', admitted: false },
  { code: 'HAF-0002', ticketId: 't2', eventId: 'evt-1', attendeeName: 'Mariam Hassan', category: 'Premium', seat: 'C-11', status: 'VALID', admitted: false },
  { code: 'HAF-0003', ticketId: 't3', eventId: 'evt-1', attendeeName: 'Omar Khaled', category: 'Standard', seat: 'H-2', status: 'VALID', admitted: false },
  { code: 'HAF-0004', ticketId: 't4', eventId: 'evt-1', attendeeName: 'Nour Adel', category: 'Standard', seat: 'H-3', status: 'VALID', admitted: false },
  { code: 'HAF-0005', ticketId: 't5', eventId: 'evt-1', attendeeName: 'Youssef Samir', category: 'VIP', seat: 'A-5', status: 'VALID', admitted: false },
  { code: 'HAF-0006', ticketId: 't6', eventId: 'evt-1', attendeeName: 'Salma Tarek', category: 'Premium', seat: 'D-7', status: 'REFUNDED', admitted: false },
  { code: 'HAF-0007', ticketId: 't7', eventId: 'evt-1', attendeeName: 'Karim Fawzy', category: 'Standard', seat: 'J-9', status: 'TRANSFERRED', admitted: false },
  { code: 'HAF-0101', ticketId: 't101', eventId: 'evt-2', attendeeName: 'Laila Mostafa', category: 'Front Stage', status: 'VALID', admitted: false },
];

const reject = (reason: RejectReason): ScanResponse => ({ result: 'REJECTED', reason });

// The guest list still uses this mock while the real events come from the backend.
// Real event ids don't match the fake ones, so show the "Cairo Jazz Night" demo guests for any unknown event.
const demoEventId = (eventId: string) => (EVENTS.some((e) => e.id === eventId) ? eventId : 'evt-1');

const admit = (t: MockTicket): ScanResponse => {
  t.status = 'USED';
  t.admitted = true;
  return { result: 'ACCEPTED', attendeeName: t.attendeeName, seat: t.seat, category: t.category };
};

export const mockApi: GateApi = {
  async login(username, password) {
    await wait(400);
    if (username.trim().toLowerCase() !== 'staff' || password !== '1234') {
      throw new Error('Wrong username or password');
    }
    return { token: 'mock-token', staff: { id: 's1', fullName: 'Gate Staff', role: 'SCANNER' } };
  },

  async getMe(token) {
    await wait(150);
    if (token !== 'mock-token') throw new Error('Please log in');
    return { id: 's1', fullName: 'Gate Staff', role: 'SCANNER' };
  },

  async getAssignedEvents() {
    await wait(300);
    return EVENTS;
  },

  async scan(_token, { eventId, code }) {
    await wait(150);
    const t = TICKETS.find((x) => x.code === code.trim());
    if (!t) return reject('INVALID');
    if (t.eventId !== eventId) return reject('WRONG_EVENT');
    if (t.status === 'USED') return reject('ALREADY_USED');
    if (t.status === 'REFUNDED') return reject('REFUNDED');
    if (t.status === 'TRANSFERRED') return reject('TRANSFERRED_AWAY');
    return admit(t);
  },

  async getGuestList(_token, eventId) {
    await wait(300);
    return TICKETS.filter((t) => t.eventId === demoEventId(eventId) &&(t.status === 'VALID' || t.status === 'USED')).map(
      ({ ticketId, attendeeName, category, seat, admitted }) => ({ ticketId, attendeeName, category, seat, admitted }),
    );
  },

  async admitManually(_token, eventId, ticketId) {
    await wait(150);
    const t = TICKETS.find((x) => x.ticketId === ticketId && x.eventId === demoEventId(eventId));
    if (!t) return reject('INVALID');
    if (t.status === 'USED') return reject('ALREADY_USED');
    if (t.status !== 'VALID') return reject('INVALID');
    return admit(t);
  },
};
