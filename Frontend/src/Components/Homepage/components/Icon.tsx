export type IconName = 'arrow' | 'search' | 'pin' | 'calendar' | 'menu' | 'close' | 'ticket' | 'clock' | 'filter' | 'bookmark' | 'user' | 'settings' | 'lock' | 'mail' | 'trash' | 'cart' | 'logout' | 'concerts' | 'festivals' | 'arts' | 'sports' | 'workshops' | 'conferences'
const paths: Record<IconName, string> = {
  cart: 'M2 3h3l3 12h11l3-9H6M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  user: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 5a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 4v3',
  mail: 'M3 5h18v14H3V5Zm0 0 9 8 9-8',
  logout: 'M9 21H3V3h6m6 4 5 5-5 5m-8-5h13',
  bookmark: 'M6 3h12v18l-6-4-6 4V3Z',
  clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  filter: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  arrow: 'M4 12h16m-6-6 6 6-6 6', search: 'M21 21l-4.4-4.4M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  menu: 'M4 6h16M4 12h16M4 18h16', close: 'm6 6 12 12M6 18 18 6', ticket: 'M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Zm12 0v3m0 3v2m0 3v3',
  concerts: 'M9 18V5l12-3v13M9 8l12-3M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-3a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  festivals: 'm12 3 2.5 6.3L21 10l-5 4.4 1.5 6.6-5.5-3.5L6.5 21 8 14.4 3 10l6.5-.7L12 3Z',
  arts: 'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 1-2.8h2a4 4 0 0 0 4-4C21 6.4 17 3 12 3ZM7 10h.01M10 6h.01M15 6h.01M18 10h.01',
  sports: 'M8 3h8v5a4 4 0 0 1-8 0V3Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v7m-4 2h8m-9 0h10',
  workshops: 'm14 3 7 7-11 11H3v-7L14 3Zm-3 3 7 7M5 13l6 6',
  conferences: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
}
export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg className={`home-icon home-icon--${name}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
