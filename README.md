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

## Project Structure

- `index.html` - semantic one-page website content
- `styles.css` - responsive visual design
- `assets/inquiry.js` - contact form submission behavior
- `favicon.svg` - site favicon
- `server.js` - minimal production static server and inquiry endpoint for Railway
- `scripts/build.js` - copies static assets into `dist/`
- `docs/` - source prompts and positioning notes
