# FullStacks.ink

Static personal/business website for Brian Salvatore and the FullStacks.ink brand.

Production URL: `https://fullstacks-production.up.railway.app/`

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

The server reads Railway's `PORT` environment variable and binds to `0.0.0.0`. No required environment variables are needed for this static site.

## Inquiry Capture

The contact form posts to `POST /api/inquiry`. For now, valid inquiries are temporarily appended to `data/inquiries.jsonl` as JSONL records. The server creates the `data/` directory if needed, and `data/*.jsonl` is ignored by git so real inquiry data is not committed.

TODO: Replace this local JSONL capture with email delivery, database storage, or CRM integration before relying on it for long-term lead handling. Railway filesystem storage may be ephemeral and should not be treated as durable production storage.

## Project Structure

- `index.html` - semantic one-page website content
- `styles.css` - responsive visual design
- `assets/inquiry.js` - contact form submission behavior
- `favicon.svg` - site favicon
- `server.js` - minimal production static server and inquiry endpoint for Railway
- `scripts/build.js` - copies static assets into `dist/`
- `docs/` - source prompts and positioning notes
