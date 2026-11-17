# Hafletna guide

`App.tsx` mounts one floating assistant inside the router. It is available on every customer route; changing routes or minimising the panel retains this visit's conversation. Refreshing clears it. Nothing is kept in browser storage.

Controls follow the shared English/Arabic and light/dark preferences. The assistant replies in the language of the question, Arabic or English.

## The live assistant

`assistantApi.ts` is the default adapter. It calls `POST /api/assistant/chat` on the backend (owned by the intelligence module) with the question and up to nine earlier messages:

```json
{ "messages": [{ "role": "user", "text": "Tell me about Art Gallery Opening" }, { "role": "assistant", "text": "…" }, { "role": "user", "text": "when do the doors open?" }] }
```

and receives `{ text, links?: [{ label, to }] }`. The request carries the login cookie, so a signed-in customer can ask about their own tickets, orders and refunds; the backend reads only that user's account and never changes anything. Visitors get public answers. The backend allows 10 questions per minute per visitor.

Answers come from Google Gemini using Hafletna's live events, venues and policies. No service secret is ever in the frontend.

## The sample adapter

`chatService.ts` is the original local, deterministic sample guide. It no longer runs on the website; tests use it, and it can be passed as the `sendMessage` prop to work on the widget without the backend.

## Behaviour

Requests time out after 45 seconds (Gemini can be slow when busy; the backend stops trying new models after 30), retry without duplicating the user's question, and are cancelled on reset/unmount. Late replies are discarded. History is bounded to 40 messages. Responses render as escaped text; links are limited to three recognised local destinations. The panel is a non-modal dialog, supports Escape and focus restoration, and honours reduced motion.

`npm test` includes catalogue guidance and async session tests. The adapter can be injected with a rejecting promise to exercise the visible error/retry state during integration tests.
