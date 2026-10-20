# Hafletna guide

`App.tsx` mounts one floating assistant inside the router. It is available on every route; changing routes or minimising the panel retains this visit's conversation. Refreshing clears it. It does not read account, ticket, cart, or browser storage data.

Controls follow the shared English/Arabic and light/dark preferences. Replies are English only (FR-BOT-07). The default adapter is a local, deterministic sample guide; it does not call an AI or backend service. It reads fictional public event data and explains existing sample booking rules. It cannot change a booking or contact support.

## Connecting the service

Implement the `ChatSend` type in `types.ts` and pass it as the `sendMessage` prop. The adapter receives only the user's current query and an `AbortSignal`, and returns plain `{ text, links?: [{ label, to }] }`. No account context is collected. Agree the API contract with the backend owner before adding an endpoint; never put service secrets in the frontend.

Requests have a 12-second timeout, retry without duplicating the user's question, and cancellation on reset/unmount. Late replies are discarded. History is bounded to 40 messages. Responses render as escaped text; optional links are limited to three recognised local destinations. The panel is a non-modal dialog, supports Escape and focus restoration, and honours reduced motion.

`npm test` includes catalogue guidance and async session tests. The adapter can be injected with a rejecting promise to exercise the visible error/retry state during integration tests.
