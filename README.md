# Chatterly Client

Next.js 16 frontend for [Chatterly](https://github.com/MahmoudBakr23/Chatterly) — a real-time chat app with voice/video calling. Communicates with the Rails API over REST and WebSocket (Action Cable), with WebRTC for peer-to-peer calls.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 6 (strict) |
| Styling | Tailwind CSS 4 |
| State | Zustand 5 (auth, conversations, presence, call stores) |
| Forms | React Hook Form 7 + Zod 4 |
| HTTP | axios 1.7 (JWT in `Authorization` header) |
| WebSockets | `@rails/actioncable` 8 |
| Calls | WebRTC (peer-to-peer media, Rails handles signaling) |
| Icons | lucide-react |
| Toasts | sonner 2 |
| Emoji | emoji-picker-react 4 |

## Architecture

```
Next.js App Router
  │
  ├── REST (axios)       → chatterly-api :3001/api/v1
  │       JWT in Authorization header
  │
  ├── WebSocket          → chatterly-api :3001/cable?token=<JWT>
  │    @rails/actioncable     ConversationChannel  — messages, reactions
  │                           PresenceChannel      — online/offline status
  │                           CallChannel          — WebRTC signaling
  │                           UserChannel          — incoming call alerts
  │
  └── WebRTC (P2P)       → direct peer connection after signaling
       media streams          ICE candidates via CallChannel
```

**Key decisions:**
- **Zustand over Redux** — minimal boilerplate, built-in devtools, store-per-concern keeps slices independent
- **Action Cable consumer created once with token** — all channel subscriptions share a single authenticated WS connection
- **Cursor-based pagination** for message history — compatible with the partitioned PostgreSQL messages table
- **Types mirror Rails blueprints** — all interfaces in `types/index.ts` match Blueprinter JSON shapes exactly; one place to update when the API changes

## App Structure

```
app/
  (auth)/             # Route group — unauthenticated layout
    login/
    register/
  (app)/              # Route group — authenticated layout (sidebar + main panel)
    conversations/
      [id]/           # Chat view for a specific conversation
  api/                # Next.js route handlers (proxying or server-side logic)
  layout.tsx
  page.tsx            # Redirects to /login or /conversations

components/
  auth/               # login-form, register-form
  chat/               # ConversationList, ConversationItem, MessageThread,
  │                   # MessageItem, MessageInput, NewConversationModal
  call/               # ActiveCallOverlay, IncomingCallModal, CallButton
  ui/                 # Shared primitives (buttons, modals, etc.)

store/
  auth.store.ts       # Current user, JWT token, login/logout
  conversations.store.ts  # Conversation list, active conversation, messages
  presence.store.ts   # Online status map (userId → boolean)
  call.store.ts       # Active call state, WebRTC peer connection

services/
  auth.service.ts
  conversations.service.ts
  messages.service.ts
  users.service.ts
  calls.service.ts

hooks/
  useConversationChannel.ts  # Subscribes to ConversationChannel for active chat
  usePresenceChannel.ts      # Tracks online/offline for visible users
  useCallChannel.ts          # WebRTC signaling + call lifecycle
  useUserChannel.ts          # Personal stream (incoming call notifications)

lib/
  actioncable.ts      # Singleton consumer factory (attaches ?token=<JWT>)

types/
  index.ts            # All TypeScript interfaces — mirrors Rails blueprint shapes

proxy.ts              # Next.js 16 proxy (replaces middleware.ts) — auth guards
```

## Local Setup

**Prerequisites:** Node.js 20+, running [chatterly-api](https://github.com/MahmoudBakr23/Chatterly) on port 3001

```bash
git clone <this-repo> chatterly-client
cd chatterly-client
npm install

# Environment
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL

npm run dev   # http://localhost:3000
```

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Rails API base URL (e.g. `http://localhost:3001`) |
| `NEXT_PUBLIC_WS_URL` | Action Cable WebSocket URL (e.g. `ws://localhost:3001/cable`) |

## Scripts

```bash
npm run dev          # dev server (http://localhost:3000)
npm run build        # production build
npm run start        # serve production build
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
npm run format       # Prettier
```

Run `npm run lint && npm run type-check` before every push.

## Calls (WebRTC)

The Rails API is signaling-only — it never handles media. Call flow:

1. Caller hits `POST /api/v1/conversations/:id/calls` → API creates a `CallSession` and broadcasts via `CallChannel`
2. Callee receives the `incoming_call` event on their `UserChannel`
3. Both sides exchange SDP offer/answer and ICE candidates through `CallChannel` actions
4. Once connected, media flows directly peer-to-peer via WebRTC
5. `end_call` / `decline` / `missed` (Sidekiq job after 30s) update the call state

## Real-time Message Flow

1. User sends message via `POST /api/v1/conversations/:id/messages`
2. Controller saves to PostgreSQL, then broadcasts the serialized message to `ConversationChannel`
3. All subscribers in the channel receive the `new_message` event and update their Zustand store
4. Reactions, edits, and soft-deletes follow the same pattern with their own event types
