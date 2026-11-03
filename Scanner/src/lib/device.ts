// A stable id for this phone, made once and kept in SecureStore.
// Sent with every scan as X-Device-Id; the backend uses it for device activation (FR-APP-05).
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'hafletna.deviceId';

export async function getDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return id;
}
