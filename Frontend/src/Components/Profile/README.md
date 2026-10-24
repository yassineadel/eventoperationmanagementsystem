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

## Profile and security API integration

Personal details use `PATCH /api/auth/me` with `fullName` and `phone`; an empty phone removes it. Only a successful server response updates the shared session, header and sidebar. Failed requests retain edits, and Discard restores the saved details.

The password dialog calls `POST /api/auth/change-password` with the current and new passwords. Confirmation and strength validation stay on the frontend; the backend verifies the current password. Google-only accounts receive a translated explanation and a Forgot password link. No password is stored in browser storage.

Email change calls `POST /api/auth/change-email/request` with `newEmail`, followed by `POST /api/auth/change-email/verify` with the six-digit code. The current address remains unchanged until the backend verifies the code and returns the updated user. Codes are delivered through the backend's configured email sender and never generated or displayed by the frontend. The dialog supports a ten-minute code lifetime, resend after a sixty-second cooldown, and changing the proposed address. Pending addresses and codes stay in component memory only.

Mutations disable duplicate submission and modal dismissal while pending, time out after fifteen seconds, and abort on navigation. Late responses do not update an unmounted screen. A timeout may follow a completed server mutation, so the UI asks the user to check the account before retrying. Server errors, session expiry and rate limiting use translated messages. Initial profile reads cannot overwrite a newly completed mutation.

Email preferences load `marketingOptIn` from the account and save through `PATCH /api/auth/me/preferences`. The backend supports one combined opt-in for event news and offers; the UI does not pretend there are independently saved preferences. Security and ticket emails are unaffected. Unknown settings show a refresh action instead of assuming an opt-out.

Deletion requests call `POST /api/auth/me/deletion` only after the user types their current email and acknowledges the request. The saved timestamp and server deadline show the pending request and its fourteen-day grace period. Reload restores pending status from `GET /api/auth/me`; its deadline is derived from the saved timestamp using the backend's fourteen-day rule. `DELETE /api/auth/me/deletion` cancels the request. A failed request or cancellation never changes local account status. Editing pauses while a request is pending. The frontend records and cancels requests only; it does not erase accounts or implement a backend purge job. Legacy sample-profile helpers are not exposed by either real account route.

`npm test` includes request-contract tests and bilingual/theme render checks. For optional isolated browser QA, run `node tests/fixtures/profile-server.mjs` and launch Vite with `VITE_API_URL=http://127.0.0.1:3002`. This fixture uses an in-memory test account and sends no email; it never connects to the application database. Set `PROFILE_FIXTURE_FAIL_PREFERENCES=1` or `PROFILE_FIXTURE_FAIL_CANCEL=1` to fail the first corresponding mutation and check retry behaviour.

All UI copy is available in English and Arabic, with RTL, light/dark themes, keyboard focus, form validation, and responsive layouts.
