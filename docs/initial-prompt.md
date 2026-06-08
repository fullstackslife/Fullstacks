You are working in the open VS Code repository for FullStacks.ink / Fullstacks.

Goal:
Turn this project into a polished personal/business website for Brian Salvatore under the FullStacks.ink brand. The site should position Brian as a practical operator who stabilizes broken business systems, with three main service pillars:

1. Hotel Stabilization & Task-Force Operations
2. AI Development & Automation
3. Business Process / Operations Stabilization

Important context:
Brian is an independent operator/contractor with experience in distressed hotel stabilization, task-force GM work, vendor coordination, staffing recovery, revenue/reporting issues, guest experience recovery, and AI/full-stack automation. The brand should not feel like a generic web developer portfolio. It should feel like a serious consulting/operator site for someone who walks into messy operations and makes them usable.

Before editing:
1. Inspect the repository structure.
2. Identify the framework, package manager, styling approach, and existing routes/components.
3. Read the README, package.json, app/pages/components directories, and any existing styling/theme files.
4. Do not rewrite the project from scratch unless the existing code is unusable.
5. Preserve working build configuration.
6. Use the existing conventions where possible.

Build requirements:
Create or update the site so it has the following sections/pages, depending on what fits the framework:

Home page:
- Hero headline:
  “Operational Stabilization, AI Systems, and Turnaround Support”
- Subheadline:
  “I help businesses regain control when operations, staffing, systems, and reporting start breaking at the same time.”
- Primary call-to-action:
  “Work With Me”
- Secondary call-to-action:
  “View Services”
- Include a short positioning section explaining that FullStacks means the full operational stack: people, process, platforms, property, payments, and performance.

Services section/page:
Create three service cards or sections:

1. Hotel Stabilization & Task-Force Operations
Description:
“Support for distressed hospitality assets, including room recovery planning, staffing support, vendor coordination, guest experience recovery, management transition, and operational due diligence.”
Bullets:
- Distressed property assessment
- Room inventory recovery planning
- Staff rebuilding and training
- Vendor coordination
- Guest reputation recovery
- OTA, folio, and revenue issue review
- Transition GM support
- Ownership or management handoff support
- Pre-sale operational due diligence

2. AI Development & Automation
Description:
“Practical AI workflows and custom tools that reduce administrative drag and improve operational visibility.”
Bullets:
- AI workflow design
- Internal tools
- Document automation
- Invoice and reporting automation
- CRM and spreadsheet cleanup
- Data extraction from PDFs, emails, and reports
- SOP generation and training systems
- Operational dashboards

3. Business Process Stabilization
Description:
“Hands-on support for companies dealing with broken workflows, unclear accountability, staffing gaps, vendor issues, and weak reporting.”
Bullets:
- Process cleanup
- Vendor tracking
- Reporting systems
- Staffing workflows
- Revenue leakage review
- Accountability mapping
- Crisis triage
- Transition planning

About section/page:
Use this copy as the base, but polish it if needed:

“I operate at the intersection of field operations, technology, and turnaround execution. My background includes hospitality stabilization, full-stack development, automation, vendor coordination, staffing support, and distressed-property operations.

Most business problems are not isolated. A revenue issue may really be a staffing issue. A staffing issue may really be a training issue. A training issue may really be a systems issue. FullStacks.ink exists to look at the whole stack, identify what is broken, prioritize what matters, and build systems that keep working after the emergency passes.”

Case Study / Experience section:
Create a case-study style section without naming confidential companies or properties.

Title:
“Distressed Hotel Stabilization”

Copy:
“Entered a bank-controlled hospitality asset with major deferred maintenance, significant out-of-order inventory, staffing shortages, vendor pressure, closed amenities, and guest satisfaction issues. Built operational visibility, prioritized room recovery, supported revenue and reporting calls, coordinated vendors, and helped prepare the property for management continuity.”

Include outcome-style bullets, carefully worded without making unverifiable claims:
- Improved operational visibility
- Prioritized room recovery efforts
- Supported staffing and recruiting needs
- Coordinated vendor and maintenance communication
- Strengthened management transition readiness
- Built clearer reporting and accountability

Contact section/page:
Create a simple contact area with these inquiry types:
- Task-force hotel support
- AI automation project
- Operations consulting
- Transition or acquisition support
- Recruiting or staffing support

If there is no backend/contact form already, create a static contact section with mailto link placeholder:
contact@fullstacks.ink

Use this label:
“Start a Conversation”

Design direction:
- Professional, sharp, modern.
- No cheesy startup gradients unless already part of the design system.
- Avoid cartoonish visuals.
- Prefer dark/neutral palette with strong typography if the project already supports it.
- Make it responsive.
- Make it readable on mobile.
- Use accessible semantic HTML.
- Keep copy concise and confident.
- Tone: direct, credible, operator-focused. Not cute. Not corporate fluff.

Technical requirements:
- Do not add unnecessary heavy dependencies.
- If using React/Next/Vite/etc., use existing routing conventions.
- If TypeScript is enabled, keep types clean.
- Ensure lint/build passes if scripts exist.
- Run the appropriate install/build/lint/test commands available in package.json.
- Fix any errors introduced by your changes.
- Keep components organized.
- Reuse existing components where sensible.
- If no component structure exists, create clean sections/components:
  - Hero
  - Services
  - About
  - CaseStudy
  - Contact
  - Footer/Nav if needed

Deliverables:
1. Update the website implementation.
2. Provide a concise summary of changed files.
3. Explain how to run locally.
4. Report whether build/lint/tests passed.
5. If something could not be verified, state exactly why.

Do not invent fake testimonials, fake logos, fake client names, fake metrics, or fake certifications.
Do not mention confidential hotel names, ownership details, foreclosure details, or private company names.
Do not make legal, brokerage, investment, or real estate commission claims.
The website should sell Brian’s value without exposing sensitive operational details.

Good. Railway is a sane choice for this, especially if the repo is a Node/Next/Vite app. It keeps the deployment path simple instead of turning your website into a DevOps hostage situation, which humanity seems oddly committed to.

Add this to the **top** of the Codex prompt I gave you:

```text
Deployment target:
This project will be deployed on Railway.

While inspecting and updating the repo, make sure the app is Railway-ready:
1. Confirm the package.json has a valid build script.
2. Confirm the package.json has a valid start script for production.
3. Make sure the app binds to Railway's provided PORT environment variable when applicable.
4. Do not hardcode localhost or a fixed port.
5. If this is a Next.js app, ensure it can run with:
   npm run build
   npm run start
6. If this is a Vite/static app, ensure it can build static assets and either:
   - use Railway-compatible static serving, or
   - include a minimal production server only if necessary.
7. Add a railway.json only if it is useful for this repo.
8. Add or update README deployment notes for Railway.
9. Do not add Docker unless the existing project already uses Docker or Railway clearly needs it.
10. Prefer the simplest Railway deployment path.

After implementation, report:
- Framework detected
- Build command
- Start command
- Whether railway.json was added
- Any environment variables needed
- Local run instructions
- Railway deployment steps
```

Then replace the **Technical requirements** section in the original prompt with this expanded version:

```text
Technical requirements:
- Do not add unnecessary heavy dependencies.
- If using React/Next/Vite/etc., use existing routing conventions.
- If TypeScript is enabled, keep types clean.
- Ensure lint/build passes if scripts exist.
- Run the appropriate install/build/lint/test commands available in package.json.
- Fix any errors introduced by your changes.
- Keep components organized.
- Reuse existing components where sensible.
- If no component structure exists, create clean sections/components:
  - Hero
  - Services
  - About
  - CaseStudy
  - Contact
  - Footer/Nav if needed

Railway deployment requirements:
- Ensure the app has a Railway-compatible production start command.
- Ensure the app uses process.env.PORT where relevant.
- Do not rely on a development server for production.
- Do not hardcode ports.
- Do not assume Vercel-specific deployment behavior.
- Add railway.json only if needed.
- Add README notes for Railway deployment.
```

### Railway setup guidance

Once Codex finishes, your Railway settings should usually be:

**Build Command**

```bash
npm run build
```

**Start Command**

```bash
npm run start
```

For **Next.js**, that is usually perfect.

For **Vite**, `npm run start` may not exist by default, because Vite builds static files and then needs something to serve `dist`. In that case Codex should either add a lightweight server or configure a static-serving command. The simplest version is usually adding `serve`:

```bash
npm install serve
```

Then package scripts:

```json
{
  "scripts": {
    "build": "vite build",
    "start": "serve -s dist -l tcp://0.0.0.0:$PORT"
  }
}
```

For **Express/Node**, Railway needs the server to listen like:

```js
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Add this as a final Codex instruction

```text
Before finishing, specifically verify that this project can deploy on Railway without relying on Vercel-only behavior. If the app is static, ensure Railway has a production way to serve the built files. If the app has a server, ensure it listens on process.env.PORT and 0.0.0.0.
```

That should stop Codex from building something pretty that dies the moment Railway tries to run it. Which is apparently considered “deployment” in modern web development.

