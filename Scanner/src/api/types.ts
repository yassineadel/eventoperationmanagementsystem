// Shapes shared by the mock API and, later, the real gate API.
// Kept in line with the backend schema (StaffAccount, ScanRecord, ScanRejectReason).

export type RejectReason =
  | 'INVALID'
  | 'ALREADY_USED'
  | 'REFUNDED'
  | 'TRANSFERRED_AWAY'
  | 'WRONG_EVENT'
  | 'EVENT_CANCELLED';

export interface Staff {
  id: string;
  fullName: string;
  role: 'SCANNER' | 'APP_ADMIN';
}

export interface LoginResult {
  token: string;
  staff: Staff;
}

// No prices or revenue anywhere in the app (FR-APP-08)
export interface GateEvent {
  id: string;
  name: string;
  venueName: string;
  startAt: string; // ISO date
  seated: boolean;
}

export interface ScanRequest {
  clientScanId: string; // generated on the device (FR-APP-26)
  eventId: string;
  code: string;
}

export type ScanResponse =
  | {
      result: 'ACCEPTED';
      attendeeName: string;
      seat?: string; // seated venues (FR-APP-11)
      category: string; // standing venues show the category (FR-APP-12)
    }
  | {
      result: 'REJECTED';
      reason: RejectReason;
    };

export interface Guest {
  ticketId: string;
  attendeeName: string;
  category: string;
  seat?: string;
  admitted: boolean;
}

export interface GateApi {
  login(username: string, password: string, deviceId: string): Promise<LoginResult>;
  getAssignedEvents(token: string): Promise<GateEvent[]>;
  scan(token: string, req: ScanRequest): Promise<ScanResponse>;
  getGuestList(token: string, eventId: string): Promise<Guest[]>;
  admitManually(token: string, eventId: string, ticketId: string, clientScanId: string): Promise<ScanResponse>;
}
