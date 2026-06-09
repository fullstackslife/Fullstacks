# FullStacks.ink

Static personal/business website for Brian Salvatore and the FullStacks.ink brand.

Live site: `https://fullstacks.ink/`

## Local Development

Install dependencies, build the static files, and start the production server:

```powershell
npm install
npm run build
$env:PORT=3000; npm run start
```

Then visit `http://localhost:3000`.

For a quick static preview, you can also open `index.html` directly in a browser.

## Railway Deployment

Railway can deploy this as a Node-served static site. No Dockerfile is required.

Use these commands in Railway:

```powershell
npm run build
npm run start
```

The server reads Railway's `PORT` environment variable and binds to `0.0.0.0`.

The static site can run without database configuration, but the inquiry form requires Railway PostgreSQL. Attach Railway PostgreSQL to the web service so Railway provides `DATABASE_URL` as a service variable. The server reads `DATABASE_URL` from Railway variables only. Do not commit, paste, print, or log the value.

For local database testing, use Railway CLI environment injection so `DATABASE_URL` is supplied by Railway for the command session instead of being copied into a local file. If you do use local environment files for other workflows, keep them uncommitted.

## Inquiry Capture

The contact form posts to `POST /api/inquiry`. When `DATABASE_URL` is present, the server creates the `inquiries` table on startup if it does not already exist, then stores valid submissions in PostgreSQL.

If `DATABASE_URL` is missing, the homepage still loads normally, but inquiry submissions return:

```json
{ "ok": false, "error": "Inquiry storage is not configured." }
```

TODO: Add email delivery or CRM notification after PostgreSQL capture so new inquiries are actively surfaced.

## Consultant Applications

The consultant form posts to `POST /api/consultant-application`. When `DATABASE_URL` is present, the server creates and updates the `consultant_applications` table on startup, including a `status` field that defaults to `New`.

Internal review is available at:

```text
/admin/consultants
```

Set this Railway service variable before using the admin dashboard:

```text
ADMIN_ACCESS_TOKEN=<strong private token>
```

The dashboard asks for that token before loading applicant data. API requests use the token as a bearer credential and are rejected when the variable is missing or the token does not match.

Admin API routes:

- `GET /api/admin/consultant-applications` lists newest applications first and supports filters for `status`, `state`, `travelPreference`, `availability`, `specialtyArea`, and keyword `q`.
- `PATCH /api/admin/consultant-applications/:id/status` updates status after validating it against: `New`, `Reviewing`, `Interview`, `Qualified`, `Available`, `Placed`, `Inactive`, `Rejected`.

Future improvements to consider: email notifications for new consultant applications, direct resume file uploads, CSV export, stronger authenticated admin accounts, and placement tracking.

## Project Structure

- `index.html` - semantic one-page website content
- `styles.css` - responsive visual design
- `assets/inquiry.js` - contact form submission behavior
- `assets/admin-consultants.js` - consultant admin dashboard behavior
- `admin/consultants.html` - protected consultant review dashboard shell
- `favicon.svg` - site favicon
- `server.js` - minimal production static server and inquiry endpoint for Railway
- `scripts/build.js` - copies static assets into `dist/`
- `migrations/` - PostgreSQL schema setup for consultant applications
- `docs/` - source prompts and positioning notes
