import { httpGetAssignedEvents, httpGetMe, httpLogin, httpScan } from './http';
import { mockApi } from './mock';
import type { GateApi } from './types';

// Real backend for login, events and scanning.
// The guest list and manual admission have no backend yet, so they still use demo data
// (the guest list screen says so clearly).
export const api: GateApi = {
  login: httpLogin,
  getMe: httpGetMe,
  getAssignedEvents: httpGetAssignedEvents,
  scan: httpScan,
  getGuestList: mockApi.getGuestList,
  admitManually: mockApi.admitManually,
};

export { ApiError, NetworkError, SignedOutError, setSignedOutHandler } from './http';
export * from './types';
