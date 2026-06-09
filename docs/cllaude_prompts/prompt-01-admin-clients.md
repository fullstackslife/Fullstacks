# Prompt 01 — Admin Clients Dashboard
# Run this first. Review output before running Prompt 02.

---

You are working inside the FullStacks.ink production codebase.

This is a focused, single-objective task.
Do NOT build anything outside this scope.
Do NOT refactor existing working code.
Do NOT change the public-facing website.
Do NOT add new dependencies unless absolutely required.

---

## CONTEXT

A technical assessment of this repository identified the following critical gap:

The `inquiries` table in Railway PostgreSQL captures property support requests submitted
through the public contact form. However, there is NO admin interface to review, manage,
or act on these inquiries. Every submitted lead is invisible to the business after submission.

The consultant admin dashboard at `/admin/consultants` already exists and works correctly.
The new `/admin/clients` page must follow the same patterns, conventions, and visual design.

Before writing any code, read these files completely:
- server.js (entire file — understand all existing routes, validation, DB patterns)
- admin/consultants.html (existing admin page structure)
- assets/admin-consultants.js (existing admin JS pattern)
- styles.css (design system and admin-specific styles)
- migrations/001_consultant_applications.sql
- migrations/002_consultant_application_admin_indexes.sql
- package.json (confirm no new dependencies needed)

---

## OBJECTIVE

Build a complete, working `/admin/clients` page that allows Brian to:
1. View all submitted property support inquiries
2. Filter by status, urgency, and current challenge type
3. View full inquiry details in an expandable panel
4. Update inquiry status
5. Add and save internal notes
6. See summary counts (New, Reviewing, Qualified, Active)

---

## DATABASE CHANGES REQUIRED

The existing `inquiries` table is missing two columns needed for admin workflow.

Add these columns via server.js `initializeDatabase()` using the existing `ALTER TABLE IF NOT EXISTS` pattern already in the file — do not create a separate migration file unless the project already coordinates them:

```sql
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'New';
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
```

Also add indexes following the existing pattern in `initializeDatabase()`:
```sql
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_urgency ON inquiries(urgency);
```

Do NOT change any existing columns.
Do NOT change how the public inquiry form inserts records.
The `inquiry_type` column currently always receives "Property support" from the server —
leave this behavior unchanged.

---

## STATUS VALUES

Use this exact list. Define it as a constant in server.js following the same pattern
as the existing `applicationStatuses` array:

```
New
Reviewing
Contacted
Qualified
Proposal
Active
Closed
Lost
Archived
```

---

## BACKEND: NEW API ROUTES

Add these three routes to server.js, following the exact same patterns as the existing
consultant admin routes. Study those routes carefully before writing these.

### GET /api/admin/inquiries

- Requires Authorization: Bearer [ADMIN_ACCESS_TOKEN] (same requireAdmin() check)
- Accepts query parameters: status, urgency, challenge, search, limit, offset
- Default: newest first, limit 100, offset 0
- Returns JSON array of inquiry records
- Sanitize and validate all query parameters before using in SQL
- Use parameterized queries only — no string interpolation in SQL

Response shape (match existing admin response conventions):
```json
{
  "inquiries": [...],
  "total": 143,
  "limit": 100,
  "offset": 0
}
```

Each inquiry object should include all columns from the `inquiries` table.

### PATCH /api/admin/inquiries/:id/status

- Requires Bearer token
- Accepts JSON body: { "status": "Reviewing" }
- Validates status against the allowed status list
- Updates status and updated_at in the database
- Returns { "ok": true }
- Returns 400 for invalid status, 404 if record not found, 401 if unauthorized

### PATCH /api/admin/inquiries/:id/notes

- Requires Bearer token
- Accepts JSON body: { "notes": "..." }
- Max length: 4000 characters
- Updates internal_notes and updated_at in the database
- Returns { "ok": true }
- Returns 400 for invalid input, 404 if not found, 401 if unauthorized

---

## FRONTEND: admin/clients.html

Create `admin/clients.html` following the structure of `admin/consultants.html` exactly.

The page must:
- Use the same CSS classes and layout as the existing admin page
- Use the same token gate pattern (prompt for token, store in localStorage under key `fullstacksAdminToken` — same key the consultant admin uses so one login works for both)
- Load inquiry data via fetch to /api/admin/inquiries
- Display summary count cards: New, Reviewing, Qualified, Active
- Display the inquiry list table
- Support expanding a row to show full detail panel
- Support status update via dropdown
- Support internal notes via textarea with a Save button
- Support filtering by: Status, Urgency, Current Challenge (keyword match)

Page header text:
- Title: "Client Inquiries"
- Subtitle: "Review hotel, property, and operations support requests."

Use hospitality-aligned language throughout:
- "Property Support Inquiry" not "Lead"
- "Current Challenge" not "Pain Point"
- "Task Force Request" not "Sales Opportunity"
- "Internal Notes" not "CRM Notes"

---

## FRONTEND: assets/admin-clients.js

Create `assets/admin-clients.js` following the structure and patterns of
`assets/admin-consultants.js` exactly.

This file must handle:
- Token gate initialization
- Fetch from /api/admin/inquiries with filter params
- Render summary count cards
- Render inquiry list table with: Property/Company, Contact Name, Email, Urgency, Challenge, Status, Date
- Expandable detail panel showing all fields (see detail field list below)
- Status dropdown → PATCH /api/admin/inquiries/:id/status
- Internal notes textarea + Save button → PATCH /api/admin/inquiries/:id/notes
- Filter controls: Status select, Urgency select, Challenge keyword input, text search
- Show loading state during fetch
- Show empty state if no results
- Handle API errors gracefully

Detail panel must show all of these fields organized into sections:

Contact Info:
- Name
- Email
- Phone
- Company
- Role (property_relationship column)

Property Info:
- Property Name
- Property Location
- Brand / Flag
- Room Count

Inquiry Info:
- Current Challenge
- Urgency
- Message (full text)
- Submitted Date

Admin Section:
- Status (dropdown, saves immediately on change)
- Internal Notes (textarea, saves on button click)
- Last Updated

---

## BUILD SCRIPT

The existing `scripts/build.js` copies files to `dist/`.

Confirm that it copies both:
- `admin/clients.html` → `dist/admin/clients.html`
- `assets/admin-clients.js` → `dist/assets/admin-clients.js`

If the build script uses a static file list, add these two files.
If it copies entire directories, no change needed — verify which it does before deciding.

---

## VALIDATION AND CONSTRAINTS

- Do NOT break any existing routes.
- Do NOT modify the public inquiry form or its submission behavior.
- Do NOT modify the consultant application form or admin dashboard.
- Do NOT add new npm dependencies.
- Do NOT expose inquiry data through any public (unauthenticated) route.
- Do NOT log full inquiry contents (name, email, message) to console.
- All SQL must use parameterized queries.
- The ADMIN_ACCESS_TOKEN check must happen before any database query in every admin route.

---

## DELIVERABLES

After completing all changes, provide:

1. List of every file created or modified with a one-line description of the change
2. Exact SQL added to initializeDatabase() for the new columns and indexes
3. Confirmation that all three new API routes are protected by requireAdmin()
4. Confirmation that the build script includes both new files
5. Confirmation that existing routes and forms are untouched
6. Any TODOs left in the code (authentication improvements, pagination, etc.)
7. Instructions for testing locally:
   - How to confirm /admin/clients loads
   - How to confirm the token gate works
   - How to confirm status updates persist
   - How to confirm internal notes persist
8. Run npm run build and report the result
9. Report any errors or warnings produced

Do not consider this task complete until npm run build passes without errors.
