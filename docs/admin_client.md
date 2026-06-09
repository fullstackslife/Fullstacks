You are working in the FullStacks.ink codebase.

Goal:
Create the equivalent admin management area for client/property support inquiries at:

/admin/clients

This should mirror the purpose and structure of the consultant admin area, but for hotel owners, management companies, asset managers, receivers, franchisees, or operators submitting property support requests.

Do NOT redesign the public website.
Do NOT change brand positioning.
Do NOT turn this into a CRM monster.
Do NOT add fake client data except optional seed/sample data clearly marked as development-only.

---

## ADMIN PAGE OBJECTIVE

Create an admin page where FullStacks can review and manage incoming property/client inquiries.

Route:

/admin/clients

This page should allow Brian / FullStacks admin users to see hotel/property support requests submitted through the public-facing contact or “Need Property Support?” form.

The admin page should support reviewing leads like:

* Task force GM request
* Property recovery inquiry
* Leadership gap
* Staffing pressure
* Revenue/reporting issue
* Out-of-order inventory problem
* Vendor delay issue
* Compliance issue
* Systems/technology support request

---

## EXPECTED DATA MODEL

If a client/property inquiry table already exists, use it.

If not, create or prepare one named something like:

client_inquiries

Suggested fields:

* id
* created_at
* updated_at
* name
* email
* phone
* company
* role
* property_name
* property_location
* brand_flag
* room_count
* current_challenge
* urgency
* message
* status
* internal_notes

Suggested status values:

* New
* Reviewing
* Contacted
* Qualified
* Proposal
* Active
* Closed
* Lost
* Archived

If the current project uses text fields instead of enums, use a text field with safe validation in application logic.

---

## ADMIN LIST VIEW

Create /admin/clients as a protected/admin-style page if an admin layout already exists.

If no authentication exists yet, still create the page but leave a clear TODO comment for authentication/protection.

The list view should show:

* Property / Company
* Contact Name
* Email
* Phone
* Current Challenge
* Urgency
* Status
* Created Date
* Actions

Actions can include:

* View Details
* Update Status
* Add Internal Notes
* Archive

Keep it practical.

No fake sales pipeline theater. Humanity has suffered enough dashboards pretending to be strategy.

---

## DETAIL VIEW

If the codebase already uses dynamic admin routes, create:

/admin/clients/[id]

If that is too much for the current structure, use an expandable detail panel or modal on /admin/clients.

The detail view should show:

Client / Contact Info:

* Name
* Email
* Phone
* Company
* Role

Property Info:

* Property Name
* Property Location
* Brand / Flag
* Room Count

Inquiry Info:

* Current Challenge
* Urgency / Timeline
* Message
* Submitted Date
* Status

Admin Fields:

* Internal Notes
* Status
* Last Updated

---

## STATUS MANAGEMENT

Allow status updates from the admin page.

Preferred statuses:

New
Reviewing
Contacted
Qualified
Proposal
Active
Closed
Lost
Archived

Status changes should persist if backend/database patterns already exist.

If persistence is not wired yet, build the UI and leave TODO comments for server action/API route/database update.

---

## INTERNAL NOTES

Add internal notes support.

Notes should not be visible publicly.

If the database table supports one internal_notes text field, use that.

If the project already has a notes/history pattern, follow that.

Do not overbuild a full activity timeline unless the project already supports it.

---

## FILTERS / SORTING

Add lightweight filtering if practical:

* Status
* Urgency
* Current Challenge

Sort newest first by default.

Do not overengineer search unless the existing admin UI already has search patterns.

---

## VISUAL / UX REQUIREMENTS

Match the existing site/admin design system.

Use existing components where possible.

The page should feel like a clean operating dashboard, not a SaaS demo pretending it has 700 enterprise clients.

Recommended sections:

1. Header:
   “Client Inquiries”
   Subtext:
   “Review hotel, property, and operations support requests.”

2. Summary cards:

   * New
   * Reviewing
   * Qualified
   * Active

3. Inquiry table/list

4. Detail/edit area

---

## BACKEND / API EXPECTATIONS

Follow existing project patterns.

If the project uses:

* Next.js server actions, use server actions.
* API routes, use API routes.
* Prisma, update Prisma schema and migrations.
* Drizzle, update Drizzle schema and migrations.
* Raw SQL, add migration/schema SQL.
* Railway PostgreSQL, ensure DATABASE_URL usage follows existing conventions.

Do not expose secrets.
Do not hardcode database URLs.
Do not break existing contact forms or consultant application forms.

---

## SUGGESTED FILES

Depending on the current app structure, likely files may include some of:

app/admin/clients/page.tsx
app/admin/clients/[id]/page.tsx
app/admin/clients/actions.ts
components/admin/ClientInquiryTable.tsx
components/admin/ClientInquiryDetail.tsx
components/admin/ClientInquiryStatusSelect.tsx
lib/client-inquiries.ts
lib/validation/client-inquiry.ts
prisma/schema.prisma OR db/schema.ts OR migrations SQL

Only create files that fit the actual codebase.

Inspect the repository first and follow existing conventions.

---

## IMPORTANT POSITIONING

Use client/admin language aligned with FullStacks’ hospitality-first brand.

This is not generic “lead management.”

These are property support inquiries.

Use labels like:

* Property Support Inquiry
* Hotel Operations Request
* Task Force Support Request
* Recovery Inquiry
* Client Inquiry

Avoid generic labels like:

* Marketing Lead
* Sales Prospect
* Funnel Stage
* Growth Opportunity

---

## SUCCESS CRITERIA

After implementation:

* /admin/clients exists.
* Admin can view incoming client/property support inquiries.
* Admin can see property details, urgency, challenge type, and contact information.
* Admin can update status if backend support exists.
* Admin can add internal notes if backend support exists.
* Page matches existing design patterns.
* No fake data is presented as real.
* Hospitality operations remains the center of the language.

---

## DELIVERABLES

After completing the work, summarize:

1. Files created or changed.
2. Whether /admin/clients is fully functional or partially scaffolded.
3. What database/table/schema changes were made.
4. Whether status updates persist.
5. Whether internal notes persist.
6. Any TODOs for authentication, notifications, admin permissions, or dashboard improvements.
