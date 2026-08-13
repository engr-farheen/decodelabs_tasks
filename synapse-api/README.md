# Synapse — URL Shortener API

A production-style REST API for shortening URLs, built as **Project 2** of the DecodeLabs Full Stack Development track: *"Develop a simple backend API to handle application logic."*

Every requirement from the brief is implemented as a real, working system — not a toy demo:

- ✅ Full REST endpoints (`GET` / `POST` / `PUT` / `PATCH` / `DELETE`)
- ✅ Two-layer validation — **syntactic** (is the request well-formed?) and **semantic** (does it make business sense?)
- ✅ Correct HTTP status codes throughout (`200`, `201`, `204`, `302`, `400`, `401`, `403`, `404`, `409`, `429`, `500`)
- ✅ Authentication (JWT) and Authorization (ownership checks on every resource)
- ✅ Stateless design + rate limiting (the "resilience / circuit breaker" requirement)
- ✅ Interactive, executable API documentation (Swagger / OpenAPI)
- ✅ Optional link expiry (`expiresInDays`)
- ✅ Deep click analytics — unique visitors, top referrers, device/browser/country breakdowns, daily trend

## Why a URL shortener

It's a small surface area with real depth: correct HTTP semantics (301 vs 302, redirect chains), collision-resistant ID generation, and natural places to demonstrate auth, rate limiting, and analytics — without the scope sprawl of a typical CRUD tutorial.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js + Express | Industry standard, minimal abstraction over HTTP |
| Database | SQLite (`better-sqlite3`) | Zero setup, single portable file, synchronous API (no accidental race conditions) |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` | Stateless sessions; passwords are never stored in plain text |
| Validation | `express-validator` | Declarative, well-tested syntactic validation |
| Docs | `swagger-jsdoc` + `swagger-ui-express` | Docs generated from the same annotations that define the routes — they can't drift out of sync |
| Security | `helmet`, `express-rate-limit`, `cors` | Standard hardening middleware |

## Architecture

```
routes/        → defines endpoints + validation rules + Swagger docs
controllers/   → translates HTTP req/res to/from plain function calls
services/      → business logic: ownership checks, semantic validation
models/        → the only layer that touches the database
middleware/    → auth, rate limiting, centralized error handling
```

Each layer only knows about the one below it. A controller never touches SQL; a service never touches `req`/`res`. This is what the assignment's "API Gateway routing to isolated services" diagram maps to in a single-process app — the seams are there even without physically separate microservices.

## Getting started

```bash
npm install
cp .env.example .env
# open .env and set JWT_SECRET to any long random string
npm start
```

Server runs at `http://localhost:3000`. Open `http://localhost:3000/api-docs` for interactive, **executable** documentation — every endpoint can be tried directly from the browser.

## Example usage

```bash
# 1. Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","password":"correct-horse-battery"}'
# → 201, returns { data: { user, token } }

# 2. Create a short link (use the token from step 1)
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"url":"https://developer.mozilla.org/en-US/docs/Web/HTTP/Status"}'
# → 201, returns { data: { code, shortUrl, ... } }

# 3. Visit the short link — redirects with a 302 and logs the click
curl -i http://localhost:3000/<code>

# 4. Check analytics (only the owner can see this)
curl http://localhost:3000/api/links/<id>/analytics \
  -H "Authorization: Bearer <token>"
```

## Design decisions worth noting

- **302, not 301, for redirects.** A 301 is cacheable by browsers, which would (a) break click analytics after the first visit and (b) permanently break the link if its destination is ever updated. A 302 keeps every click live.
- **Same error message for "no such user" and "wrong password."** Distinguishing them lets an attacker enumerate which emails have accounts — a well-known information-leak pattern.
- **A link can't shorten a link pointing back at this service.** Prevents an obvious self-referential redirect loop.
- **`express.json({ limit: '10kb' })`.** This API never needs a large payload; capping it early is a cheap defense against abuse.

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create an account |
| POST | `/api/auth/login` | — | Get a JWT |
| POST | `/api/links` | ✅ | Shorten a URL |
| GET | `/api/links` | ✅ | List your links (paginated) |
| GET | `/api/links/:id` | ✅ (owner) | Get one link |
| PUT | `/api/links/:id` | ✅ (owner) | Replace a link entirely (url required) |
| PATCH | `/api/links/:id` | ✅ (owner) | Partially update destination / active state |
| DELETE | `/api/links/:id` | ✅ (owner) | Delete a link |
| GET | `/api/links/:id/analytics` | ✅ (owner) | Click stats |
| GET | `/:code` | — | Redirect (the actual short link) |
| GET | `/health` | — | Uptime check |
| GET | `/api-docs` | — | Interactive documentation |

Full request/response schemas, including validation rules, are in the Swagger docs — that's the source of truth, not this table.

---

Built as part of the DecodeLabs Full Stack Development internship.
