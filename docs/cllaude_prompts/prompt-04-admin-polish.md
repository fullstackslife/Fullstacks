# Prompt 04 — Admin Polish: CSV Export, Pagination, Deduplication
# Run after Prompt 03 is complete and reviewed.
# Touches server.js, both admin HTML files, and both admin JS files.

---

You are working inside the FullStacks.ink production codebase.

This is a focused, single-objective task covering three admin quality-of-life improvements.
Do NOT build anything outside this scope.
Do NOT change the public website.
Do NOT change the security headers or rate limiting added in the previous pass.

---

## CONTEXT

After completing the core admin infrastructure, these three gaps remain that
limit the operational usefulness of the admin dashboards:

1. No CSV export — the consultant and client databases cannot be extracted
   for analysis, reporting, or backup
2. Hardcoded LIMIT 250 in admin list routes — will silently truncate data as
   the database grows
3. No duplicate detection on form submissions — the same person can submit
   multiple consultant applications and the admin has no visibility into this

---

## TASK 1: CSV Export for Consultant Applications

### Backend

Add a new route to server.js:

`GET /api/admin/consultant-applications/export.csv`

Requirements:
- Requires Bearer token (same requireAdmin() check)
- Accepts same filter parameters as the existing list route:
  status, state, travelPreference, availability, specialtyArea, search
- Returns a CSV file download (not JSON)
- Response headers:
  ```
  Content-Type: text/csv; charset=utf-8
  Content-Disposition: attachment; filename="consultant-applications-[YYYY-MM-DD].csv"
  ```
- Use the current date (server time) in the filename
- No new dependencies — build CSV manually using string construction
  (data is simple enough that a CSV library is not warranted)

CSV columns (in this order):
```
id, created_at, first_name, last_name, email, phone, city, state,
current_hospitality_role, years_experience, travel_preference, availability,
specialty_areas, brands_worked_with, management_companies, linkedin_url,
resume_url, compensation_expectations, status, notes
```

CSV requirements:
- First row is headers (column names as listed above)
- Properly escape fields that may contain commas or quotes (wrap in quotes,
  double any internal quotes — standard RFC 4180 CSV)
- specialty_areas is a PostgreSQL array — join values with semicolon before
  exporting (e.g., "Revenue Management;Housekeeping")
- Format created_at as ISO 8601 string
- Empty/null values export as empty string (no "null" text)
- Handle up to 10,000 rows without timing out (add LIMIT 10000 on query)

### Frontend

In `admin/consultants.html` and `assets/admin-consultants.js`:

Add an "Export CSV" button to the filter/action bar area.
The button should:
- Be clearly labeled "Export CSV"
- Trigger a GET request to the export route with current filter state applied
  (so "Export CSV" exports the currently filtered view, not all records)
- Open the download in the browser naturally (use window.location or an anchor tag
  with the URL — do not use fetch for file downloads)
- Show a brief "Preparing export..." state if needed
- Be visually consistent with the existing admin UI style

---

## TASK 2: CSV Export for Client Inquiries

Add the equivalent export route and button for inquiries.

### Backend

`GET /api/admin/inquiries/export.csv`

Same pattern as consultant export.

CSV columns:
```
id, created_at, updated_at, name, email, phone, company, property_name,
property_location, brand_flag, room_count, property_relationship,
current_challenge, urgency, message, status, internal_notes
```

Do NOT export: source, user_agent, ip (operational metadata, not needed in exports)

Filename: `property-inquiries-[YYYY-MM-DD].csv`

Filters accepted: status, urgency, challenge (same as the list route)

### Frontend

Add "Export CSV" button to `admin/clients.html` and `assets/admin-clients.js`
following the same pattern as Task 1.

---

## TASK 3: Replace Hardcoded LIMIT 250 with Pagination

The current admin list routes have a hardcoded LIMIT 250 that will silently
truncate results as the database grows.

### Backend changes

For both `GET /api/admin/consultant-applications` and `GET /api/admin/inquiries`:

Replace hardcoded LIMIT 250 with:
- Accept `limit` query parameter (default: 50, max: 200)
- Accept `offset` query parameter (default: 0)
- Return total count alongside results so the frontend can show pagination state

Response shape (update existing):
```json
{
  "consultants": [...],  // or "inquiries"
  "total": 143,
  "limit": 50,
  "offset": 0,
  "hasMore": true
}
```

To get total count efficiently, run a COUNT query with the same WHERE conditions
before the main query. Use the same parameterized approach.

### Frontend changes

In both admin JS files, add simple pagination:

- Show "Showing X–Y of Z results" below the table
- Add "Load More" button that appears when hasMore is true
- Clicking "Load More" fetches the next page and appends rows to the table
  (do not replace — append)
- Do not implement full numbered pagination — Load More is sufficient

The "Load More" approach is appropriate because:
- These are internal admin tools, not public-facing lists
- Appending results is operationally natural for reviewing new submissions
- It avoids complexity while still handling large datasets

---

## TASK 4: Duplicate Email Detection for Consultant Applications

### Backend

In the consultant application POST handler, after validation and before INSERT:

1. Query the database for any existing application with the same email address
2. If found, do NOT insert a duplicate — return HTTP 409 with:
   ```json
   {
     "ok": false,
     "error": "An application with this email address already exists."
   }
   ```
3. If not found, proceed with the INSERT as normal

Implementation note: use a parameterized SELECT COUNT(*) or SELECT id query,
not a raw email string in SQL.

Do NOT add duplicate detection to the inquiry form — the same person may
legitimately submit multiple property inquiries about different properties
or situations. Only the consultant application needs this.

### Frontend

In `assets/inquiry.js`, handle the new 409 response code for the consultant form:

Show the message:
"An application with this email address is already on file. If you need to update
your information, please reach out directly."

Style this consistently with the existing error message pattern.

---

## CONSTRAINTS

- Do not break existing routes
- Do not change security headers or rate limiting from Prompt 03
- Do not change the public contact form
- No new npm dependencies
- All SQL must remain parameterized
- Admin routes must remain protected by requireAdmin()
- CSV export routes must also be protected by requireAdmin()

---

## DELIVERABLES

1. List of every file modified
2. Exact route paths for the two new CSV export endpoints
3. Confirmation that CSV export requires authentication
4. Confirmation that filters are applied to CSV exports
5. Description of the Load More pagination behavior
6. Confirmation that duplicate email check returns 409 before any DB insert
7. Result of npm run build
8. Manual test instructions:
   - How to test CSV export with and without filters
   - How to verify pagination (how to create enough test records to test)
   - How to test duplicate email detection
