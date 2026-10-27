// The real gate API: talks to the backend (Backend/src/modules/gate).
import { getDeviceId } from '@/lib/device';

import type { GateEvent, LoginResult, ScanRequest, ScanResponse, Staff } from './types';

const BASE = process.env.EXPO_PUBLIC_API_URL;
const TIMEOUT_MS = 10_000; // a gate can't wait forever; after this we treat it as "no connection"

// The server answered with an error (wrong password, not assigned, too many scans...).
// `message` is the backend's own message, ready to show on screen.
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// No answer from the server at all (no Wi-Fi, server down, or too slow).
// The request may or may not have reached the server, so it is safe to retry only with the same clientScanId.
export class NetworkError extends Error {
  constructor() {
    super('No connection to the server. Check the Wi-Fi and try again.');
  }
}

// The login is no longer valid (expired, or the staff account was blocked). The app has already
// been told to sign out, so screens should just stop: the login screen will show the reason.
export class SignedOutError extends ApiError {}

// The session registers a function here, so any request can sign the app out
let onSignedOut: ((reason: string) => void) | null = null;
export function setSignedOutHandler(handler: ((reason: string) => void) | null) {
  onSignedOut = handler;
}

// One HTTP request. Returns the JSON body, or throws ApiError / NetworkError.
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!BASE) throw new Error('EXPO_PUBLIC_API_URL is not set in Scanner/.env');

  // Give up after TIMEOUT_MS
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }

  // The backend always answers JSON; anything else (e.g. a proxy error page) has no body we can use
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const fallback = res.status >= 500 ? 'The server had a problem. Please try again.' : `Request failed (${res.status})`;
    throw new ApiError(body?.message ?? fallback, res.status);
  }
  if (body === null) throw new ApiError('Unexpected answer from the server', res.status);
  return body as T;
}

const json = { 'Content-Type': 'application/json' };
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/**
 * A request that needs the staff login. If the login stopped working, sign the app out.
 * - 401: the token is invalid or expired.
 * - 403: could be "this account is blocked" OR "not assigned to this event". To tell them apart we ask
 *   GET /me: if /me also fails, the account is the problem; if /me works, it was only a permission error.
 */
async function authed<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await request<T>(path, { ...init, headers: { ...init.headers, ...bearer(token) } });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      const loginProblem = e.status === 401 ? e : await checkLogin(token);
      if (loginProblem) {
        onSignedOut?.(loginProblem.message);
        throw new SignedOutError(loginProblem.message, loginProblem.status);
      }
    }
    throw e;
  }
}

// Returns the error if the login itself is no longer accepted, otherwise null
async function checkLogin(token: string): Promise<ApiError | null> {
  try {
    await httpGetMe(token);
    return null;
  } catch (e) {
    return e instanceof ApiError && (e.status === 401 || e.status === 403) ? e : null;
  }
}

// POST /api/gate/login
export async function httpLogin(username: string, password: string): Promise<LoginResult> {
  return request<LoginResult>('/api/gate/login', {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ username, password }),
  });
}

// GET /api/gate/me: who is logged in. Used on start-up to check the saved login.
export async function httpGetMe(token: string): Promise<Staff> {
  const { staff } = await request<{ staff: Staff }>('/api/gate/me', { headers: bearer(token) });
  return staff;
}

// GET /api/gate/events: the events this staff member can scan
export async function httpGetAssignedEvents(token: string): Promise<GateEvent[]> {
  const { events } = await authed<{ events: GateEvent[] }>(token, '/api/gate/events');
  return events;
}

// POST /api/gate/scan: check one QR code. The phone's id goes in the X-Device-Id header.
export async function httpScan(token: string, req: ScanRequest): Promise<ScanResponse> {
  const deviceId = await getDeviceId();
  return authed<ScanResponse>(token, '/api/gate/scan', {
    method: 'POST',
    headers: { ...json, 'X-Device-Id': deviceId },
    body: JSON.stringify(req),
  });
}
