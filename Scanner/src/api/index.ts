import { httpLogin } from './http';
import { mockApi } from './mock';

// Real backend for login; everything else stays fake until it's built
export const api = { ...mockApi, login: httpLogin };
export * from './types';