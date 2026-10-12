// The one place that decides which API the app talks to.
// When the backend gate module is ready, replace mockApi with the real client here.
import { mockApi } from './mock';

export const api = mockApi;
export * from './types';
