// Holds who is logged in and which event they are scanning for.
// The login token lives in SecureStore, never in plain storage.
import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { api, ApiError, GateEvent, setSignedOutHandler, Staff } from '@/api';

export { getDeviceId } from './device';

const TOKEN_KEY = 'hafletna.token';
const STAFF_KEY = 'hafletna.staff'; // name and role, so the app can start even with no connection

interface Session {
  isLoading: boolean; // true while the saved login is being checked at start-up
  token: string | null;
  staff: Staff | null;
  event: GateEvent | null;
  signOutReason: string | null; // why the app signed itself out, shown on the login screen
  signIn(token: string, staff: Staff): Promise<void>;
  signOut(): Promise<void>;
  selectEvent(event: GateEvent | null): void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [event, setEvent] = useState<GateEvent | null>(null);
  const [signOutReason, setSignOutReason] = useState<string | null>(null);

  // Forget the login, on the phone and in memory
  async function clear() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(STAFF_KEY);
    setToken(null);
    setStaff(null);
    setEvent(null);
  }

  // On start-up: load the saved login and check it with the server (GET /api/gate/me)
  useEffect(() => {
    async function restore() {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!saved) return; // nobody logged in: show the login screen

      try {
        const me = await api.getMe(saved);
        setToken(saved);
        setStaff(me);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          // The server says this login is no longer valid (expired or blocked)
          await clear();
          setSignOutReason(e.message);
        } else {
          // No connection (or a server problem): we can't check now, so keep the saved login.
          // If it turns out to be invalid, the next request will sign the app out.
          const savedStaff = await SecureStore.getItemAsync(STAFF_KEY);
          setToken(saved);
          setStaff(savedStaff ? JSON.parse(savedStaff) : null);
        }
      }
    }

    restore()
      .catch((e) => console.warn('Could not restore the login', e))
      .finally(() => setIsLoading(false));
  }, []);

  // While the app is in use: if any request finds the login no longer valid, sign out and say why.
  // Leaving the protected screens sends the user to the login screen (see _layout.tsx).
  useEffect(() => {
    setSignedOutHandler((reason) => {
      clear();
      setSignOutReason(reason);
    });
    return () => setSignedOutHandler(null);
  }, []);

  const value: Session = {
    isLoading,
    token,
    staff,
    event,
    signOutReason,
    async signIn(t, s) {
      await SecureStore.setItemAsync(TOKEN_KEY, t);
      await SecureStore.setItemAsync(STAFF_KEY, JSON.stringify(s));
      setSignOutReason(null);
      setToken(t);
      setStaff(s);
    },
    async signOut() {
      await clear();
      setSignOutReason(null);
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
