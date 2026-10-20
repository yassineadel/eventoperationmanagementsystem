// Holds who is logged in and which event they are scanning for.
// The login token lives in SecureStore, never in plain storage.
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useContext, useState } from 'react';

import type { GateEvent, Staff } from '@/api';

const DEVICE_ID_KEY = 'hafletna.deviceId';
const TOKEN_KEY = 'hafletna.token';

// A stable id for this phone; the backend uses it for device activation (FR-APP-05).
export async function getDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return id;
}

interface Session {
  token: string | null;
  staff: Staff | null;
  event: GateEvent | null;
  signIn(token: string, staff: Staff): Promise<void>;
  signOut(): Promise<void>;
  selectEvent(event: GateEvent | null): void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [event, setEvent] = useState<GateEvent | null>(null);

  const value: Session = {
    token,
    staff,
    event,
    async signIn(t, s) {
      await SecureStore.setItemAsync(TOKEN_KEY, t);
      setToken(t);
      setStaff(s);
    },
    async signOut() {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setToken(null);
      setStaff(null);
      setEvent(null);
    },
    selectEvent: setEvent,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession must be used inside SessionProvider');
  return s;
}
