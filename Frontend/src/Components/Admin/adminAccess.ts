/**
 * Lets developers open the console without a running backend: `VITE_ADMIN_PREVIEW=true`
 * in Frontend/.env.local, development builds only. The sample admin is then "you".
 * Kept apart from the console so the route guard stays small in the customer bundle.
 */
export const ADMIN_PREVIEW = import.meta.env.DEV && import.meta.env.VITE_ADMIN_PREVIEW === 'true'

export function isAdminRole(role: string | undefined) {
  return role?.toUpperCase() === 'ADMIN'
}
