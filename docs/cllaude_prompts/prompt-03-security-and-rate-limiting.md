# Prompt 03 — Security Headers and Rate Limiting
# Run after Prompt 02 is complete and reviewed.
# This is a server.js-only task. No frontend changes required.

---

You are working inside the FullStacks.ink production codebase.

This is a focused, single-objective task.
Do NOT build anything outside this scope.
Do NOT refactor working code that is not security-related.
Do NOT touch any HTML, CSS, or admin JS files.

---

## CONTEXT

A security assessment identified these gaps in server.js:

1. No HTTP security headers on any response
2. No rate limiting on POST /api/inquiry or POST /api/consultant-application
3. No health check endpoint for Railway monitoring
4. No caching headers on static assets (performance/reliability gap)

These are straightforward server.js changes. No new dependencies should be needed.
All four items should be implemented in a single focused pass.

---

## TASK 1: HTTP Security Headers

Add a `setSecurityHeaders(res)` function near the top of server.js (after pool init,
before route handlers). Call it at the start of every request handler before
sending any response.

Add these headers to ALL responses (HTML, JSON, and API):

```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Add this Content-Security-Policy only to HTML page responses (not API/JSON responses):

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'
```

Note: `'unsafe-inline'` for style-src is required because the existing CSS uses
inline style attributes in a few places. Do not change the HTML to accommodate
a stricter policy — that is out of scope for this task.

Implementation approach:
- Add one helper function: `setSecurityHeaders(res, isHtml)`
- Call it in the static file server before writing the response
- Call it in each API route handler before writing the response
- Do not duplicate header-setting logic

---

## TASK 2: In-Memory Rate Limiting

Add IP-based rate limiting to the two public POST endpoints:
- POST /api/inquiry
- POST /api/consultant-application

Do NOT rate-limit:
- Admin routes (admin users should not be throttled)
- Static file serving
- GET requests

Implementation requirements:

Use a simple in-memory sliding window approach. No external dependency needed.
The implementation should live in a self-contained `RateLimiter` class or factory
function defined near the top of server.js.

Parameters (define as named constants so they can be adjusted easily):
```javascript
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 5;            // per IP per window
```

Behavior:
- Track requests by IP address (use req socket remoteAddress, fall back to
  x-forwarded-for header if Railway proxies connections — check both)
- If an IP exceeds the limit within the window, return HTTP 429 with:
  ```json
  { "ok": false, "error": "Too many submissions. Please try again later." }
  ```
- Periodically clean up expired entries to prevent memory growth.
  Clean up on every rate limit check for IPs whose window has expired,
  or add a cleanup interval (every 30 minutes) — your choice, document which.
- Do not log the IP address of rate-limited requests in full — log only that
  a rate limit was hit: `Rate limit exceeded for submission endpoint`

Edge cases to handle:
- Missing or empty IP address: allow the request (fail open, not closed)
- IPv6 addresses: treat as-is (no normalization needed)
- Multiple submissions from same IP that are legitimate (e.g., testing):
  The 5/10min limit is intentionally lenient enough for real use

---

## TASK 3: Caching Headers for Static Assets

In the static file server section of server.js, add appropriate Cache-Control headers
based on file type:

For CSS and JS files (`*.css`, `*.js`):
```
Cache-Control: public, max-age=86400
```
(1 day — reasonable since there's no cache-busting hash in filenames)

For HTML files (`*.html`):
```
Cache-Control: no-cache
```
(Force revalidation so admin pages and the main site always load fresh)

For SVG/image files:
```
Cache-Control: public, max-age=604800
```
(1 week — favicon and static images change rarely)

---

## TASK 4: Health Check Endpoint

Add a GET /health route to server.js.

The route must:
- Not require authentication
- Check database connectivity with a simple `SELECT 1` query
- Return HTTP 200 with:
  ```json
  { "ok": true, "db": true, "ts": "2026-06-08T12:00:00.000Z" }
  ```
- If the DB query fails, still return HTTP 200 (the server is running) but with:
  ```json
  { "ok": true, "db": false, "ts": "2026-06-08T12:00:00.000Z" }
  ```
- Timeout the DB check after 3 seconds to prevent hanging
- Do not log health check requests to avoid noise in Railway logs

---

## CONSTRAINTS

- server.js only — no other files need changes
- No new npm dependencies
- Do not break any existing routes or behaviors
- Do not change validation logic
- Do not change the admin token mechanism
- Do not change form submission behavior
- The ADMIN_ACCESS_TOKEN comparison must remain timing-safe (existing logic is correct — preserve it)

---

## DELIVERABLES

1. Summary of each change made in server.js
2. The exact `setSecurityHeaders` function signature and where it is called
3. The rate limiter constants and how to adjust them
4. Confirmation that /health returns correctly with and without DB
5. Confirmation that rate limiting does NOT affect admin routes
6. Confirmation that HTML caching is set to no-cache
7. Result of npm run build
8. Manual test instructions:
   - How to verify security headers (curl command)
   - How to verify /health endpoint
   - How to simulate rate limiting (curl loop command)
   - How to verify caching headers on static assets
