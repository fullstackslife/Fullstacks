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

## Project Structure

- `index.html` - semantic one-page website content
- `styles.css` - responsive visual design
- `favicon.svg` - site favicon
- `server.js` - minimal production static server for Railway
- `scripts/build.js` - copies static assets into `dist/`
- `docs/` - source prompts and positioning notes
