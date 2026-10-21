# Customer profile frontend

Two screens share the existing public-site header, footer, preferences, and auth form components:

- `/profile`: personal details and current email/verification status.
- `/profile/settings`: password change, verified email change, optional communication preferences, and account deletion requests.

The header's **My account** link opens the account gate. Signed-in customers instead get a name/avatar menu with profile, settings, saved events, and sign out. On mobile these entries are available inside the main navigation menu; signed-in customers also have a profile shortcut next to the menu button.

## Session integration

SessionProvider checks the existing cookie-backed `GET /api/auth/me` endpoint with an eight-second timeout. Login and the Google callback update this shared session. Account routes display a sign-in/retry gate for unauthenticated or unavailable sessions. Return destinations are restricted to the two account routes. Logout uses the existing `POST /api/auth/logout`; a failed logout keeps the signed-in UI and displays a retryable error. Tokens and passwords are never placed in browser storage.

Session responses support both `fullName` and the repository's older `first_name`/`last_name` fields. Missing verification information is shown as unknown, rather than assumed verified.

## Real account access

Both profile routes require a signed-in account and display its current session details. The sample-profile option has been removed. Legacy `?preview=1` URLs follow the same session checks and cannot open a fictional profile. The pages do not read or write saved sample-profile data.

## Backend work still required

This checkout has no endpoints for updating personal details, changing an authenticated password, requesting/verifying an email change, reading/updating communication preferences, or requesting/cancelling account deletion. These operations remain disabled for real accounts. The existing dialogs and validation helpers remain available for future integration, but no sample mutation flow is accessible through the profile pages. Agree those API contracts with the backend owner, then connect the forms and load real communication/deletion state.

All UI copy is available in English and Arabic, with RTL, light/dark themes, keyboard focus, form validation, and responsive layouts.
