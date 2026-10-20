import type { LoginResult } from './types';

const BASE = process.env.EXPO_PUBLIC_API_URL;

// Calls POST /api/gate/login on your backend
export async function httpLogin(username: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BASE}/api/gate/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json();
  // If the server said no (401, 403…), show its message on the login screen
  if (!res.ok) throw new Error(body.message ?? 'Login failed');
  return body;
}