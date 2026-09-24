# Getting started with the Indent Easy API

Indent Easy exposes one **GraphQL** API for the web and mobile apps, plus a small **REST** API for
the things GraphQL fits poorly: authentication cookies, file transfer, provider webhooks, SAP file
exchange and health probes. Both follow the rules on this page.

> **Status.** The API is being built phase by phase. The [implementation status](../status/) page
> shows which operations work today. Every other operation in the contract answers with
> `NOT_IMPLEMENTED`. Features marked *planned* below are specified but not built yet.

## Environments

| Environment | GraphQL | REST base |
|---|---|---|
| Local | `http://localhost:4000/graphql` | `http://localhost:4000/api/v1` |
| DEV | `http://dev.indent-easy.local/graphql` | `http://dev.indent-easy.local/api/v1` |
| QA | `http://qa.indent-easy.local/graphql` | `http://qa.indent-easy.local/api/v1` |
| PROD | `http://prod.indent-easy.local/graphql` | `http://prod.indent-easy.local/api/v1` |

DEV, QA and PROD are reachable from the office network. HTTPS and the final domain arrive with the
production server. Introspection and the GraphiQL explorer are enabled on Local, DEV and QA, never on PROD.

## Your first request

```sh
curl -s http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -H 'X-Request-ID: my-first-call' \
  -d '{"query":"{ featureFlags { key enabled } }"}'
```

```json
{ "data": { "featureFlags": [{ "key": "hindi_ui", "enabled": true }] } }
```

## Authentication *(planned: Phase 1)*

| Token | Lifetime | Where it lives |
|---|---|---|
| Access token (JWT, ES256) | 10 minutes | Memory only; sent as `Authorization: Bearer <token>` |
| Refresh token | Web: 60 min idle / 7 days absolute. Mobile: 14 days idle / 30 days absolute | Web: `HttpOnly` cookie `ie_rt` scoped to `/api/v1/auth`. Mobile: secure storage |
| CSRF token | Session | Web only: cookie `ie_csrf` echoed in the `X-CSRF-Token` header |

Log in with `POST /api/v1/auth/login`. When an access token expires (`AUTH_TOKEN_EXPIRED`), call
`POST /api/v1/auth/refresh` once and retry. Refresh tokens rotate on every use; reusing an old one
revokes the whole session. Permission changes take effect within 60 seconds.

## Request headers

| Header | Required | Purpose |
|---|---|---|
| `Content-Type: application/json` | Yes, for bodies | JSON only; 1 MB limit. Files never go through the API; they use pre-signed uploads |
| `X-Request-ID` | Recommended | Your ID for this call (≤ 64 characters: letters, digits, `.` `_` `:` `-`). Echoed back and included in every error. Generated if absent or invalid |
| `X-Correlation-ID` | Optional | Ties several calls into one business flow (for example sale → SMS → delivery). Defaults to the request ID |
| `X-Client-Name` / `X-Client-Version` | Recommended | `web`, `mobile-android`, `mobile-ios` or `integration:<name>`, plus a semantic version |
| `Accept-Language` | Optional | `en-IN` or `hi-IN`; affects messages, never data |
| `Idempotency-Key` | On marked operations | See [Idempotency](#idempotency) |

Every response carries `X-Request-ID`. Quote it when reporting a problem.

## Errors

Every error has a stable **code** from one catalogue, shared by GraphQL and REST.

**GraphQL: expected outcomes** (validation, business rules, conflicts) come back in the mutation's
`userErrors`, with HTTP 200 and a path to the offending field:

```json
{
  "data": {
    "createIndent": {
      "indent": null,
      "userErrors": [
        { "code": "INDENT_DUPLICATE_LINE", "message": "validation.indent.duplicateLine",
          "field": ["input", "lines", "2", "productId"], "details": { "duplicateOf": 0 } }
      ]
    }
  }
}
```

`message` is a translation key; the apps show it in English or Hindi.

**GraphQL: exceptional failures** (authentication, permissions, not found, rate limits, outages) come
back in the top-level `errors` array:

```json
{
  "errors": [{
    "message": "Query.me is not available yet.",
    "path": ["me"],
    "extensions": { "code": "NOT_IMPLEMENTED", "requestId": "my-first-call", "retryable": false }
  }],
  "data": null
}
```

**REST** errors use [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) `application/problem+json`:

```json
{
  "type": "urn:indent-easy:problem:not-found",
  "title": "Not Found",
  "status": 404,
  "code": "NOT_FOUND",
  "detail": "No route for GET /api/v1/nope",
  "requestId": "my-first-call"
}
```

| Category | HTTP (REST) | GraphQL placement | Examples | What the client should do |
|---|---|---|---|---|
| Validation | 400 | `userErrors` | `VALIDATION_FAILED`, `PRODUCT_INACTIVE` | Highlight the fields |
| Authentication | 401 | `errors` | `AUTH_TOKEN_EXPIRED` | Refresh once, else log in |
| Authorization | 403 | `errors` | `FORBIDDEN`, `APPROVAL_NOT_ASSIGNED` | Show the message; don't retry |
| Not found | 404 | `errors` | `NOT_FOUND` | — |
| Business rule | 422 | `userErrors` | `INVENTORY_INSUFFICIENT`, `GRN_OVER_TOLERANCE` | Show an actionable message |
| Conflict | 409 | `userErrors` | `VERSION_CONFLICT`, `APPROVAL_ALREADY_ACTED` | Reload, then retry |
| Rate limit | 429 | `errors` | `RATE_LIMITED` | Back off (`Retry-After`) |
| External / internal | 503 / 500 | `errors` | `EXTERNAL_SERVICE_UNAVAILABLE`, `INTERNAL_ERROR` | Retry idempotent calls later; show the request ID |

Messages never contain stack traces, SQL or provider responses.

## Idempotency

Operations that change money, stock or documents require a client-generated UUID (v4 or v7), sent
as the `Idempotency-Key` header or the `idempotencyKey` input field. Generate **one key per user
intent** and reuse it for retries. The mobile app stores it with each queued offline action.

- Same key, same request: the original response is replayed; nothing happens twice.
- Same key, different request: `IDEMPOTENCY_KEY_REUSED` (409).
- Keys are kept 24 hours (7 days for operations the mobile app can queue offline).

## Pagination, filtering and sorting

- GraphQL lists use Relay cursors: `first` (at most 100, default 20) and `after`, returning `pageInfo`.
- REST lists use `limit` (at most 100) and an opaque `cursor`, returning `nextCursor`.
- Filters are typed inputs; date ranges include both ends. Sorting is `{ field, direction }`, with
  `id` as a stable tie-breaker. Text search needs at least 2 characters.

## Concurrency

Updates carry `expectedVersion`. If someone else changed the record first you get
`VERSION_CONFLICT`: reload and re-apply the change.

## Limits *(rate limits planned: Phase 1)*

| Limit | Value |
|---|---|
| GraphQL query depth | 10 |
| GraphQL query cost | 5,000 |
| Aliases per query | 15 |
| Requests per user | 600 per minute, of which at most 60 mutations; 10 exports per hour |
| Unauthenticated requests per IP | 30 / minute |

Queries over the depth or cost limit are rejected before they run, with `VALIDATION_FAILED`.

## Time, money and quantities

- Timestamps are UTC, RFC 3339 (`2026-09-24T05:30:00Z`); show them in Asia/Kolkata.
- Calendar dates (`requiredBy`) are `YYYY-MM-DD` in Asia/Kolkata.
- Money and quantities are **decimal strings** (`"1250.50"`, `"12.500"`), never floats: INR with 2
  decimals, quantities with up to 3.

## Real-time updates *(planned)*

GraphQL subscriptions over WebSocket (`graphql-ws`) on the same `/graphql` endpoint deliver
notifications, indent and approval changes, stock updates and document readiness.

## Health and version

| Endpoint | Meaning |
|---|---|
| `GET /health/live` | The process is running |
| `GET /health/ready` | PostgreSQL, Redis and the migrations are OK; returns 503 otherwise |
| `GET /api/v1/version` | Version, commit and a hash of the GraphQL schema |
