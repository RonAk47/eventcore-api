# EventCore API

EventCore is a small REST API for virtual event management. It supports user authentication, organizer-owned event management, attendee registration, and Gmail email notifications using in-memory storage.

## Requirements

- Node.js 20 or newer
- npm
- A Gmail account with two-factor authentication enabled for real registration emails

## Setup

```bash
npm install
cp .env.sample .env
```

Update `.env` with local values:

```dotenv
NODE_ENV=development
PORT=3000
JWT_SECRET=use-a-long-random-secret
JWT_EXPIRES_IN=1h
ORGANIZER_REGISTRATION_CODE=your-organizer-invite-code
GMAIL_USER=your-gmail-address@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
EMAIL_DAILY_LIMIT=400
EMAIL_MIN_INTERVAL_MS=1000
LOGIN_RATE_LIMIT=20
REGISTER_RATE_LIMIT=10
```

`.env` is ignored by Git and must never be committed. `GMAIL_APP_PASSWORD` must be a Google App Password, not your normal Gmail password.

## Running

```bash
npm run dev
```

For a regular start:

```bash
npm start
```

The API runs at `http://localhost:3000` by default.

## Testing

```bash
npm test
npm run lint
```

The test suite covers authentication, authorization, event CRUD, participant registration, validation, email payload construction, and email quota behavior. Tests use in-memory data and do not send real emails.

## Architecture

```text
Routes -> Middleware -> Controllers -> Services -> Repositories -> In-memory store
```

- `routes`: HTTP endpoint definitions
- `middleware`: authentication, roles, ownership, and request validation
- `controllers`: HTTP request and response handling
- `services`: business rules and external email integration
- `repositories`: in-memory data access; inputs and returned records are defensively copied, so changes must go through explicit repository methods
- `data`: process-local `Map` storage

Data is reset when the process restarts.

## Authentication

Register and login responses do not expose password hashes. Protected endpoints require:

```http
Authorization: Bearer <jwt-token>
```

Login and registration have separate in-memory limits per client IP: by default 20 login attempts and 10 registration attempts per 15-minute window. Configure these using `LOGIN_RATE_LIMIT` and `REGISTER_RATE_LIMIT`. All requests reaching these route limiters count, including invalid credentials and missing fields. Exceeding a limit returns `429 RATE_LIMIT_EXCEEDED` with a `Retry-After` header. Counters reset on restart. Each limiter tracks at most 10,000 active IPs; new IPs are temporarily rejected when that capacity is full. Forwarded IP headers are not trusted; deployments behind a proxy must configure Express trust proxy for their specific proxy topology.

`JWT_EXPIRES_IN` is validated at startup. Use a positive duration of at least one second, such as `1h` or `2 days`. A digits-only value such as `3600` means seconds. Invalid or non-positive durations prevent startup.

Public attendee registration defaults to the `attendee` role. To create an organizer, include the configured invite code:

```json
{
    "name": "Event Organizer",
    "email": "organizer@example.com",
    "password": "secure-password",
    "role": "organizer",
    "registrationCode": "your-organizer-invite-code"
}
```

## API Reference

All request bodies use `Content-Type: application/json`.

### Health

#### `GET /health`

Returns the service status.

### Authentication

#### `POST /register`

Creates an attendee or organizer account.

Passwords must be at least 8 characters and no more than 72 UTF-8 bytes. Non-ASCII characters can use multiple bytes. Login also rejects passwords over this byte limit.

Required fields:

```json
{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "secure-password"
}
```

Returns `201 Created`. Organizer registration additionally requires `role: "organizer"` and a valid `registrationCode`.

#### `POST /login`

```json
{
    "email": "jane@example.com",
    "password": "secure-password"
}
```

Returns a JWT and the safe user profile.

#### `GET /me`

Requires authentication. Returns the current user profile.

### Events

#### `GET /events`

Returns all events. Authentication is not required.

#### `GET /events/:id`

Returns one event and its `participantCount`. Participant IDs are never returned in public event responses. Authentication is not required.

#### `POST /events`

Requires an authenticated organizer. The organizer becomes the event owner.

Event `date` and `time` are always interpreted as **UTC**, using `YYYY-MM-DD` and 24-hour `HH:mm` respectively. For example, `2026-10-15` with `18:00` means `2026-10-15T18:00:00Z`. Clients must convert local times to UTC before submitting and convert UTC to the viewer’s timezone for display. Confirmation emails label the time as UTC.

```json
{
    "title": "JavaScript Workshop",
    "date": "2026-10-15",
    "time": "18:00",
    "description": "An introductory workshop"
}
```

#### `PUT /events/:id`

Requires the authenticated organizer to own the event. The full event body is required.

#### `DELETE /events/:id`

Requires the authenticated organizer to own the event. Returns `204 No Content`.

### Participant Registration

#### `POST /events/:id/register`

Requires authentication. Registers the current user once and queues a Gmail confirmation email without waiting for delivery. The response reports `emailNotification: "queued"` when accepted into the queue, or `"failed"` if enqueueing fails (for example, missing Gmail configuration or a full queue). A successful registration is retained even if enqueueing or delivery fails. Queued messages capture event details at registration time and escape event text in HTML.

#### `DELETE /events/:id/register`

Requires authentication. Cancels the current user's registration. Returns `204 No Content`.

#### `GET /me/events`

Requires authentication. Returns events where the current user is registered.

## Error Responses

Application errors use a consistent shape:

```json
{
    "error": {
        "code": "EVENT_NOT_FOUND",
        "message": "Event not found"
    }
}
```

Common status codes are `400` for invalid input, `401` for missing or invalid authentication, `403` for insufficient permissions, `404` for missing resources, `409` for conflicts, and `429` for authentication rate limits (with a `Retry-After` header). Event registration remains successful if its notification cannot be queued or delivered. `emailNotification: "queued"` acknowledges queue acceptance, not delivery; subsequent failures, including exhausted email quota, are logged in the background. There is no delivery-status endpoint or automatic retry.

## Email Quota

Registration notifications are sent through Gmail SMTP. Gmail is not uncapped: personal accounts have daily sending and recipient limits, and Google may throttle automated traffic. The default limiter allows 400 successful emails per UTC day and waits at least one second after each completed attempt, including failures, before starting the next. Failed attempts do not consume the successful-send quota. Both limits can be changed through `.env`.

The in-memory queue allows at most 100 pending/in-flight notifications. Pending messages are lost on restart. The quota is also in memory and resets when the process restarts or when the UTC day changes; the attempt interval is preserved across midnight. A production deployment should use a persistent counter or queue.

## Postman

Import [eventcore-api.postman_collection.json](eventcore-api.postman_collection.json) into Postman and start the API with a fresh in-memory store.

1. Set `baseUrl`, `organizerRegistrationCode`, and `password` (at least 8 characters, at most 72 UTF-8 bytes).
2. Set `expectedEmailNotification` to `queued` when Gmail credentials are configured, or `failed` when they are absent. Queue acceptance does not guarantee delivery.
3. Run **Health → Authentication → Events → Validation** in Collection Runner. Login requests save tokens, and event creation saves `eventId`, only after successful responses. Requests assert status codes, safe response fields, and expected validation errors. Event dates and times are UTC.
4. **Optional rate-limit checks** are skipped by default. To run them last, set `runRateLimitChecks=true` and `maxRateLimitAttempts` above your configured login and registration limits (default probe cap: 25). The runner repeats missing-field requests until each endpoint returns `429`, then checks the error code and `Retry-After`. These probes create no accounts but intentionally exhaust both quotas. Individual Send does not follow the runner loop.

Saved response examples show both email notification statuses and rate-limit errors. Restart the server before repeating the complete workflow to clear existing accounts and counters; rerunning against an existing store can produce duplicate-email errors or rate limits. Restarting also discards pending emails.

The collection covers HTTP behavior. `npm test` covers concurrent registration, expired tokens, email HTML escaping and failure spacing, UTC day rollover, startup configuration validation, and repository copy isolation. `npm run lint` checks unused variables/imports and undefined names.
