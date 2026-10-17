# Customer profile frontend

Two screens share the existing public-site header, footer, preferences, and auth form components:

- `/profile`: personal details and current email/verification status.
- `/profile/settings`: password change, verified email change, optional communication preferences, and account deletion requests.

The header's **My account** link opens the account gate. Signed-in customers instead get a name/avatar menu with profile, settings, saved events, and sign out. On mobile these entries are available inside the main navigation menu; signed-in customers also have a profile shortcut next to the menu button.

## Session integration

SessionProvider checks the existing cookie-backed `GET /api/auth/me` endpoint with an eight-second timeout. Login and the Google callback update this shared session. Account routes display a sign-in/retry gate for unauthenticated or unavailable sessions. Return destinations are restricted to the two account routes. Logout uses the existing `POST /api/auth/logout`; a failed logout keeps the signed-in UI and displays a retryable error. Tokens and passwords are never placed in browser storage.

Session responses support both `fullName` and the repository's older `first_name`/`last_name` fields. Missing verification information is shown as unknown, rather than assumed verified.

## Explicit sample mode

Add `?preview=1` to either route, or select **Try sample profile**, to exercise the frontend without a backend account. This always selects a fictional profile, even when a real session exists. Sample profile details, email, optional preferences, and deletion-request state use a separate local-storage key, `hafletna.profile-preview`. Blocked/full storage falls back to the current visit with a visible message.

The sample current password is `HafletnaDemo1`. Password change validates the current value, password rules, and confirmation, then clears all password fields; it does not create credentials or store a password/hash. Sample email codes are displayed on screen, expire after five minutes, lock after five incorrect attempts, and have a 30-second resend delay. Codes are held only in memory; the current email changes only after verification. Cancel/reload discards an unverified change. Deletion requires matching the current email and an explicit acknowledgement. It records a cancellable sample request and does not remove an account. Pending sample deletion pauses other sample edits.

## Backend work still required

This checkout has no endpoints for updating personal details, changing an authenticated password, requesting/verifying an email change, reading/updating communication preferences, or requesting/cancelling account deletion. These operations remain disabled for real accounts. No endpoints were invented and no backend files were changed. Agree those API contracts with the backend owner, then replace the sample handlers and load real communication/deletion state. Do not present frontend sample verification or deletion as server-enforced account security.

All UI copy is available in English and Arabic, with RTL, light/dark themes, keyboard focus, form validation, and responsive layouts.
