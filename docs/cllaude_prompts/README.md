# FullStacks Claude Code Prompt Sequence
# Generated: June 2026
# Purpose: Sequential improvement prompts for fullstacks.ink codebase

---

## How to Use These Prompts

Run ONE prompt at a time. Review the output. Confirm it works.
Then run the next prompt.

Do NOT combine prompts. Do NOT skip prompts.
Each prompt builds on the state left by the previous one.

---

## Prompt Sequence

### Prompt 01 — Admin Clients Dashboard
File: prompt-01-admin-clients.md
What it does: Builds /admin/clients to review and manage property support inquiries.
              Adds status, internal_notes, updated_at to the inquiries table.
              Adds three new admin API routes. Mirrors the existing consultant admin pattern.
Risk level: Medium (database schema change + new routes)
Review checklist before running Prompt 02:
  - [ ] /admin/clients loads in browser
  - [ ] Token gate works
  - [ ] Inquiry list populates
  - [ ] Status update persists after page reload
  - [ ] Internal notes persist after page reload
  - [ ] npm run build passes
  - [ ] Existing /admin/consultants still works
  - [ ] Public inquiry form still submits

---

### Prompt 02 — Email Notifications
File: prompt-02-email-notifications.md
What it does: Adds transactional email notifications when new inquiries or
              consultant applications are submitted. Gracefully disabled if
              env vars are not set.
Risk level: Low (additive only, no schema changes)
Prerequisite: Choose and sign up for the recommended email provider before running.
Review checklist before running Prompt 03:
  - [ ] Server starts without email env vars set
  - [ ] Server starts with email env vars set
  - [ ] Public form submission still works when email is disabled
  - [ ] Email received when form is submitted (test with real env vars)
  - [ ] npm run build passes

---

### Prompt 03 — Security Headers and Rate Limiting
File: prompt-03-security-and-rate-limiting.md
What it does: Adds HTTP security headers to all responses, IP-based rate limiting
              on public POST endpoints, caching headers on static assets,
              and a /health endpoint.
Risk level: Low (server.js only, no schema or file changes)
Review checklist before running Prompt 04:
  - [ ] curl -I https://[site] shows X-Content-Type-Options header
  - [ ] /health returns {"ok":true,"db":true}
  - [ ] Submitting form 6 times from same IP returns 429 on 6th
  - [ ] Admin routes are NOT rate limited
  - [ ] npm run build passes

---

### Prompt 04 — Admin Polish
File: prompt-04-admin-polish.md
What it does: Adds CSV export for both admin dashboards, replaces hardcoded
              LIMIT 250 with real pagination (Load More), and adds duplicate
              email detection for consultant applications.
Risk level: Low (additive routes + frontend JS additions)
Review checklist before running Prompt 05:
  - [ ] Export CSV button appears on /admin/consultants
  - [ ] Export CSV button appears on /admin/clients
  - [ ] CSV download contains correct columns
  - [ ] CSV export respects active filters
  - [ ] Load More works on both admin pages
  - [ ] Duplicate email on consultant form returns clear error message
  - [ ] npm run build passes

---

### Prompt 05 — Products Section + Sensitive Docs Cleanup
File: prompt-05-products-section-and-cleanup.md
What it does:
  Part A: Moves GPT transcript files and legacy test data out of the main
          docs/strategy directory into docs/private/ and adds to .gitignore.
  Part B: Adds a #systems section to the public homepage with four product
          family cards. Adds "Systems" to navigation.
Risk level: Low (HTML/CSS only for Part B, file moves for Part A)
Review checklist after running:
  - [ ] docs/private/ exists with moved files
  - [ ] docs/strategy/ no longer contains GPT transcripts
  - [ ] docs/private/ is in .gitignore
  - [ ] "Systems" appears in navigation
  - [ ] #systems section renders correctly on desktop and mobile
  - [ ] All four product family cards present
  - [ ] Copy matches tone guidelines (no buzzwords, no fake claims)
  - [ ] npm run build passes

---

## After All 5 Prompts Are Complete

The following items remain for future prompt sequences:

### Recovery Board (Separate Project)
The Recovery Board is the first operational pilot module.
It requires its own scoped prompt sequence covering:
- Database schema (recovery_items, vendors, projects tables)
- Protected pilot interface (separate from public site)
- Assignment and status workflow
- Basic dashboard view
- Do not begin until the 5 prompts above are complete and stable.

### Future Admin Improvements
- Email notifications when inquiry status changes
- Activity log / notes history (append-only notes vs single notes field)
- Consultant assignment tracking (link consultants to properties)
- Multi-user admin access (currently single shared token)

---

## Environment Variables Reference

Variables required across all prompts:

| Variable               | Required By    | Description                                    |
|------------------------|----------------|------------------------------------------------|
| DATABASE_URL           | Server startup | Railway PostgreSQL connection string           |
| ADMIN_ACCESS_TOKEN     | Prompt 01      | Admin dashboard access token                  |
| NOTIFICATION_EMAIL_TO  | Prompt 02      | Admin email to receive notifications           |
| NOTIFICATION_EMAIL_FROM| Prompt 02      | Verified sender address for email provider    |
| RESEND_API_KEY         | Prompt 02      | API key for Resend (or equivalent)             |
| PORT                   | Always         | Set by Railway automatically                  |

All variables must be set in Railway dashboard → Service → Variables.
Never commit these to the repository.
