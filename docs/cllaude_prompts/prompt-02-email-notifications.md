# Prompt 02 — Email Notifications for New Submissions
# Run after Prompt 01 is complete and reviewed.
# Do NOT run this until /admin/clients is working and confirmed.

---

You are working inside the FullStacks.ink production codebase.

This is a focused, single-objective task.
Do NOT build anything outside this scope.
Do NOT refactor working code.
Do NOT change the public website.

---

## CONTEXT

The site currently captures two types of submissions:
1. Property support inquiries → `inquiries` table → POST /api/inquiry
2. Consultant applications → `consultant_applications` table → POST /api/consultant-application

Both workflows write to PostgreSQL successfully. However, there is no notification
when a new submission arrives. Brian must manually check /admin/clients or
/admin/consultants to discover new leads, which means leads go unactioned.

---

## OBJECTIVE

Add email notifications so that whenever a new inquiry or consultant application
is submitted, an email is sent to a configured admin address.

Notifications must:
- Fire after successful database insert, not before
- Not block or delay the HTTP response to the submitter
- Fail silently if email sending fails (log the error, still return success to user)
- Never expose email credentials in logs, responses, or error messages

---

## STEP 1: EVALUATE AND RECOMMEND

Before writing any code, evaluate the following options and recommend the best one
for this specific stack (vanilla Node.js HTTP server, no framework, Railway deployment):

Option A: Resend (resend.com)
- Free tier: 3,000 emails/month, 100/day
- Node.js SDK available
- Simple API, reliable deliverability
- Requires RESEND_API_KEY env var

Option B: Postmark (postmarkapp.com)
- Free tier: 100 emails/month (test), paid after
- Strong deliverability, transactional focus
- Requires POSTMARK_API_TOKEN env var

Option C: Nodemailer with SMTP (Gmail, etc.)
- No additional account required if Gmail is available
- Less reliable for production deliverability
- Requires SMTP credentials in env vars
- App password required for Gmail

Option D: Nodemailer with Railway SMTP add-on
- If Railway provides SMTP, this avoids external accounts
- Check Railway's current add-on offerings

Write a brief recommendation (3-5 sentences) stating which option you recommend
and why, based on: free tier adequacy for low-volume use, Node.js simplicity,
Railway compatibility, and long-term reliability.

Then implement the recommended option. If you recommend Resend, implement Resend.
Do not implement multiple options.

---

## IMPLEMENTATION REQUIREMENTS

### Dependency

Add exactly one new dependency to package.json for the chosen email provider.
Document the exact npm install command needed.

If using Resend: `npm install resend`
If using Postmark: `npm install postmark`
If using Nodemailer: `npm install nodemailer`

### Environment Variables Required

The implementation must read all credentials from environment variables.
Define the required variable names clearly in a comment block near the email
initialization code, for example:

```
// Required environment variables for email notifications:
// NOTIFICATION_EMAIL_TO   — Admin email address to receive notifications
// NOTIFICATION_EMAIL_FROM — Verified sender address (must match your email provider domain)
// RESEND_API_KEY          — API key from resend.com (or equivalent for chosen provider)
//
// If any of these are missing, email notifications are disabled silently.
// The site will still function normally without email configured.
```

### Graceful Degradation

If email environment variables are not set, the server must still start and
function normally. Email notifications should be disabled, not required.

Add a startup log message:
- If configured: `Email notifications: enabled (sending to [NOTIFICATION_EMAIL_TO])`
- If not configured: `Email notifications: disabled (RESEND_API_KEY not set)`

Do not log the actual API key or credentials.

### Email for New Property Inquiry

Trigger: after successful INSERT into `inquiries`
Send to: NOTIFICATION_EMAIL_TO

Subject:
`New Property Inquiry — [property_name or company if no property name] — [urgency]`

Body (plain text, clean and scannable):
```
New property support inquiry submitted on FullStacks.ink

CONTACT
Name: [name]
Email: [email]
Phone: [phone or Not provided]
Company: [company or Not provided]

PROPERTY
Property Name: [property_name or Not provided]
Location: [property_location or Not provided]
Brand / Flag: [brand_flag or Not provided]
Room Count: [room_count or Not provided]

INQUIRY
Challenge: [current_challenge or Not provided]
Urgency: [urgency or Not provided]
Message:
[message]

Submitted: [created_at formatted as readable date/time]

Review this inquiry at: https://fullstacks.ink/admin/clients
```

Do NOT include internal_notes or status in the notification email.
Do NOT include IP address or user_agent in the notification email.

### Email for New Consultant Application

Trigger: after successful INSERT into `consultant_applications`
Send to: NOTIFICATION_EMAIL_TO

Subject:
`New Consultant Application — [first_name] [last_name] — [current_hospitality_role]`

Body (plain text):
```
New consultant application submitted on FullStacks.ink

APPLICANT
Name: [first_name] [last_name]
Email: [email]
Phone: [phone]
Location: [city], [state]

EXPERIENCE
Current Role: [current_hospitality_role]
Years Experience: [years_experience]
Travel Preference: [travel_preference]
Availability: [availability]

SPECIALTIES
[specialty_areas joined by comma, or Not provided]

Submitted: [created_at formatted as readable date/time]

Review this application at: https://fullstacks.ink/admin/consultants
```

Do NOT include compensation_expectations, resume_url, or notes in the notification.

### Error Handling

Wrap all email sends in try/catch.
On failure: log `Email notification failed: [error message]` (not the full stack trace).
Never let email failure affect the HTTP response to the user.
Never let email failure affect the database insert.

---

## WHERE TO ADD IN server.js

Add the email notification as a fire-and-forget call immediately after the
successful database INSERT in each handler:

```javascript
// Fire notification — do not await, do not block response
sendNewInquiryNotification(insertedRecord).catch(err => {
  console.error('Email notification failed:', err.message);
});
```

Place the email utility functions near the top of server.js, after the
database pool initialization and before the route handlers.

---

## VALIDATION

- Confirm the server still starts without email configured (variables absent)
- Confirm the server still starts with email configured
- Confirm public forms still submit and write to DB when email fails
- Run npm run build and confirm it passes
- Run npm install and confirm the new dependency installs correctly

---

## DELIVERABLES

1. Which email provider was chosen and why (3-5 sentence rationale)
2. Exact npm install command
3. New environment variables required and their purpose
4. Files modified (should be server.js only, plus package.json)
5. Description of graceful degradation behavior
6. Instructions for testing locally without a real email account configured
7. Railway setup instructions: which variables to add in Railway dashboard
8. Result of npm run build
9. Any edge cases or limitations to be aware of
