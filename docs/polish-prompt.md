You are working in the open VS Code repository for FullStacks.ink / Fullstacks.

The site is already deployed on Railway at:
https://fullstacks-production.up.railway.app/

Goal:
Polish and reposition the site around Brian Salvatore’s actual strongest value proposition: hospitality turnaround, task-force operations, revenue continuity, operational stabilization, and AI/systems automation.

This is not a generic developer portfolio.
This is not a generic AI consultant site.
This is a serious operator/consulting website for someone brought in when operations are failing, revenue is leaking, staffing has collapsed, audits are at risk, or leadership coverage has broken down.

Important positioning:
Brian is an independent operator/contractor with 10+ years of hospitality operations experience across branded, independent, select-service, full-service, and luxury properties. His background includes task-force management, distressed hotel stabilization, revenue integrity, nightly audit control, staff rebuilding, vendor coordination, operational continuity, and AI/full-stack automation.

Primary brand idea:
FullStacks means the full operational stack:
people, process, platforms, property, payments, and performance.

Primary homepage headline:
“When Operations Fail, I Restore Control.”

Primary homepage subheadline:
“Hospitality turnaround specialist, task-force operator, and systems builder helping businesses recover revenue, rebuild accountability, and stabilize operations.”

Primary CTA:
“Work With Me”

Secondary CTA:
“View Services”

Before editing:

1. Inspect the repository structure.
2. Identify the framework, package manager, styling approach, and existing routes/components.
3. Read README, package.json, app/pages/components directories, and styling/theme files.
4. Do not rewrite the project from scratch unless the existing code is unusable.
5. Preserve working build and Railway deployment configuration.
6. Use existing conventions where possible.
7. Do not add unnecessary dependencies.
8. Do not add fake claims, fake testimonials, fake logos, fake client names, fake metrics, or confidential property details.

Site structure:
Shape the website around these four service categories.

1. FullStacks Hospitality
   Tagline:
   “Task-Force Operations, Hotel Stabilization & Revenue Recovery”

Description:
“Support for distressed hospitality assets, including interim leadership, room recovery planning, staffing support, vendor coordination, guest experience recovery, management transition, and operational due diligence.”

Service bullets:

* Interim GM and task-force management
* Distressed property assessment
* Room inventory recovery planning
* Staff rebuilding and training
* Vendor coordination
* Guest reputation recovery
* OTA, folio, and revenue issue review
* Night audit and revenue integrity
* Ownership or management handoff support
* Pre-sale operational due diligence

2. FullStacks Intelligence
   Tagline:
   “AI Systems That Reduce Administrative Drag”

Description:
“Practical AI workflows, reporting systems, and internal tools that improve operational visibility and reduce manual work.”

Service bullets:

* AI workflow design
* Internal tools
* Document automation
* Invoice and reporting automation
* CRM and spreadsheet cleanup
* Data extraction from PDFs, emails, and reports
* SOP generation and training systems
* Operational dashboards
* Cloud and automation support

3. FullStacks Recovery
   Tagline:
   “When Operations Break Down”

Description:
“Hands-on support for companies dealing with broken workflows, unclear accountability, staffing gaps, vendor issues, and weak reporting.”

Service bullets:

* Process stabilization
* Vendor tracking
* Reporting systems
* Staffing workflows
* Revenue leakage review
* Accountability mapping
* Crisis triage
* Transition planning
* Operational continuity support

4. FullStacks Advisory
   Tagline:
   “Due Diligence, Acquisition Support & Operational Assessment”

Description:
“Operational review and transition support for owners, investors, and management companies evaluating distressed or underperforming assets.”

Service bullets:

* Property condition and operations review
* Pre-acquisition operational assessment
* Management transition planning
* Staffing and leadership evaluation
* Revenue and audit control review
* Vendor and service continuity review
* Stabilization roadmap development

About section:
Use this copy as the base, polished only if needed:

“I operate at the intersection of field operations, technology, and turnaround execution. My background includes hospitality stabilization, full-stack development, automation, vendor coordination, staffing support, and distressed-property operations.

Most business problems are not isolated. A revenue issue may really be a staffing issue. A staffing issue may really be a training issue. A training issue may really be a systems issue. FullStacks.ink exists to look at the whole stack, identify what is broken, prioritize what matters, and build systems that keep working after the emergency passes.”

Experience / Case Study section:
Create a section titled:
“Distressed Hotel Stabilization”

Use this copy:
“Entered a bank-controlled hospitality asset with major deferred maintenance, significant out-of-order inventory, staffing shortages, vendor pressure, closed amenities, and guest satisfaction issues. Built operational visibility, prioritized room recovery, supported revenue and reporting calls, coordinated vendors, and helped prepare the property for management continuity.”

Outcome-style bullets:

* Improved operational visibility
* Prioritized room recovery efforts
* Supported staffing and recruiting needs
* Coordinated vendor and maintenance communication
* Strengthened management transition readiness
* Built clearer reporting and accountability

Do not name specific hotel brands, current companies, ownership entities, foreclosure details, or confidential property information in this case study.

“Why I’m Brought In” section:
Add a punchy section with these points:

* Revenue is leaking and controls have failed
* Staffing or leadership coverage has collapsed
* Audit risk or compliance exposure is escalating
* Schedules, supervision, or accountability have broken down
* Ownership needs immediate stability without onboarding delay
* Operations need someone who can act without waiting for perfect conditions

Contact section:
Create a simple conversion-focused contact area.

Heading:
“Start a Conversation”

Copy:
“If your operation needs stabilization, transition support, automation, or a clear recovery plan, reach out.”

Inquiry types:

* Task-force hotel support
* AI automation project
* Operations consulting
* Transition or acquisition support
* Recruiting or staffing support

Use contact email:
[contact@fullstacks.ink](mailto:contact@fullstacks.ink)

If there is no backend form, use a mailto link. Do not create a backend unless one already exists.

Design direction:

* Professional, sharp, modern, and credible.
* Dark or neutral palette is preferred if compatible with existing design.
* Strong typography.
* Clean service cards.
* Strong mobile layout.
* Avoid cheesy startup visuals.
* Avoid fake dashboards or fake analytics.
* Avoid cartoonish icons unless the existing style already uses them.
* The site should feel like a serious consulting/operator site, not a side-project portfolio.

SEO and metadata:
Add or improve:

* Page title
* Meta description
* Open Graph title
* Open Graph description
* Twitter/social preview metadata if supported
* Favicon support if missing
* Footer with FullStacks.ink branding

Suggested SEO title:
“FullStacks.ink | Hotel Stabilization, AI Automation & Operations Recovery”

Suggested meta description:
“FullStacks.ink helps distressed hotels and overloaded businesses stabilize operations, recover revenue control, rebuild accountability, and implement practical AI automation.”

Railway deployment requirements:
This project is deployed on Railway. Preserve or improve Railway readiness.

* Confirm package.json has a valid build script.
* Confirm package.json has a valid production start script.
* Ensure the app binds to Railway’s PORT environment variable when applicable.
* Do not hardcode localhost or a fixed port.
* Do not assume Vercel-specific deployment behavior.
* If this is a static/Vite app, ensure the built files are served correctly in production.
* If this is a server app, ensure it listens on process.env.PORT and 0.0.0.0.
* Add railway.json only if useful.
* Do not add Docker unless truly necessary.

Technical requirements:

* Use existing routing conventions.
* Use existing styling conventions where practical.
* If TypeScript is enabled, keep types clean.
* Reuse existing components where sensible.
* If component structure is weak or missing, organize into clean components:

  * Hero
  * Services
  * About
  * WhyBroughtIn
  * CaseStudy
  * Contact
  * Footer/Nav if needed
* Make the layout responsive and accessible.
* Use semantic HTML.
* Keep copy concise, confident, and operator-focused.

Validation:
Run the available commands from package.json:

* install if needed
* build
* lint if available
* tests if available

Fix any errors introduced by your changes.

Final report:
After completing changes, provide:

1. Framework detected
2. Package manager detected
3. Files changed
4. Build command
5. Start command
6. Railway deployment notes
7. Whether build/lint/tests passed
8. Any environment variables required
9. Any items that could not be verified and why
