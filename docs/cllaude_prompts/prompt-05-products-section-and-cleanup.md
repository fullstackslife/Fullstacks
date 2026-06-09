# Prompt 05 — Products/Systems Section + Sensitive Docs Cleanup
# Run after Prompt 04 is complete and reviewed.
# This prompt has two independent parts. Part A (docs cleanup) has no risk.
# Part B (products section) touches index.html, styles.css, and scripts/build.js only.

---

You are working inside the FullStacks.ink production codebase.

This is a focused task with two distinct parts.
Do NOT change any admin pages built in previous prompts.
Do NOT change server.js.
Do NOT add new dependencies.

---

## PART A: Sensitive Document Cleanup

A security assessment identified that the following files in the `docs/` directory
contain sensitive business information that should not remain in the repository
in their current state:

- `docs/strategy/gpt-chat.md` — Contains a full ChatGPT conversation including
  real names of individuals (James, Lola, Randy, Bonnie), real company names
  (Luminous, La Quinta, New Cumberland), internal strategy discussions, and
  pilot program details.

- `docs/strategy/gpt-marekting.md` — Same category of sensitive content.

- `docs/strategy/file.md` — Misnamed file containing Python zip-generation code,
  not a strategy document.

- `data/inquiries.jsonl` — Legacy test file from pre-PostgreSQL development.
  Contains one test record. Should not remain.

### Instructions

For the GPT transcript files:

1. Create a new directory: `docs/private/`
2. Move both GPT transcript files into `docs/private/`
3. Create `docs/private/README.md` with this content:

```markdown
# Private Documents

This directory contains internal strategy documents, conversation logs,
and business planning materials that are not intended for public distribution.

These files have been moved here from docs/strategy/ to separate them from
the operational documentation that may be shared with partners or collaborators.

Files in this directory should be added to .gitignore if this repository
is ever made public or shared.
```

4. Add this line to .gitignore (add a comment above it):
```
# Private strategy documents — do not commit to public repos
docs/private/
```

5. Do NOT delete the original files before confirming the move was successful.
   Verify the files exist in docs/private/ before removing from docs/strategy/.

For `docs/strategy/file.md`:
- Move to `docs/private/file-python-zip-script.md`
- This is just a rename/relocation — no content change needed

For `data/inquiries.jsonl`:
- This file is already in .gitignore
- Move it to `docs/private/legacy-test-data.jsonl` for documentation purposes
- Or delete it if confirmed it is truly just a test file with no real data
  (inspect the file first to confirm it is safe to remove)

### Note on docs/strategy/ after cleanup

After the moves, `docs/strategy/` should contain only:
- `fullstacks-business-model.md`
- `consultant-network.md`
- Any other legitimate planning documents

Confirm what remains and list it in the deliverables.

---

## PART B: Products/Systems Section

### Context

The business model defines four product families that represent FullStacks'
long-term platform vision:

1. FullStacks Recovery — Tools for distressed hotel operational recovery
2. FullStacks Operations — Scheduling, availability, and accountability
3. FullStacks Reporting — Owner reporting and operational visibility
4. FullStacks Task Force — Consultant deployment and coverage management

This section does not currently exist on the public website. Adding it does
two things for the business:
1. Communicates the platform roadmap to potential management company partners
2. Creates a natural entry point for conversations like the Luminous pilot

### Positioning Rules (READ BEFORE WRITING ANY COPY)

This section must NOT say or imply:
- "AI-powered hotel operating system"
- "Replace your PMS"
- "All-in-one platform"
- "Fully integrated with every system"
- "Instant automation"
- Any invented pricing or subscription tiers
- Any fake screenshots or fake dashboards

This section MUST:
- Position FullStacks as building tools AROUND systems hotels already use
- Use language like "planned capability", "available as custom implementation",
  "operational visibility layer", "built around existing systems"
- Sound like it was written by someone who has actually run a distressed hotel,
  not a software marketer

### What to Build

Add a new section to `index.html` after the Services section and before
the Experience/Case Study section.

The section should have:
- Anchor: `id="systems"`
- Navigation link: Add "Systems" to the existing nav (after "Services")

Section structure:

**Headline:**
"Hospitality Systems Built Around Real Operations"

**Subheadline:**
"FullStacks develops practical operational tools that sit alongside the systems
hotels already use — filling the gaps in visibility, accountability, and
reporting that no existing platform covers."

**Bridging paragraph:**
"Hotels already rely on property management systems, payroll platforms, accounting
software, and operations tools. FullStacks focuses on what falls through the gaps:
the room recovery board that doesn't exist, the owner report that takes hours to
assemble, the staff availability tracker living in text messages, and the vendor
follow-up that disappears when one manager is off."

**Four product family cards:**

Each card should show:
- Product family name
- Tagline
- 4-6 representative capabilities (short bullets)
- One CTA appropriate for the audience

---

Card 1: FullStacks Recovery
Tagline: "Operational Visibility for Distressed and Transitioning Properties"
Capabilities:
- Out-of-order room recovery tracking
- Vendor coordination and follow-up
- Maintenance and project status
- Return-to-service workflow
- Inspection readiness tracking
- Recovery status reporting
CTA: "Discuss Property Recovery"
CTA href: "#contact"

Card 2: FullStacks Operations
Tagline: "Scheduling, Availability, and Daily Accountability"
Capabilities:
- Staff scheduling (single and multi-property)
- Availability and coverage tracking
- Open shift management
- Department checklists and handoffs
- Manager accountability routines
- Daily operating rhythm support
CTA: "Request Operations Support"
CTA href: "#contact"

Card 3: FullStacks Reporting
Tagline: "Owner and Operator Visibility Across Revenue, Labor, and Inventory"
Capabilities:
- Weekly owner reports
- Revenue and AR visibility
- Labor and staffing summaries
- Room inventory and OOO status
- Risk and priority summaries
- Exportable operational dashboards
CTA: "Discuss Reporting Needs"
CTA href: "#contact"

Card 4: FullStacks Task Force
Tagline: "Consultant Deployment and Coverage Planning"
Capabilities:
- Consultant availability tracking
- Assignment and deployment management
- Multi-property coverage planning
- Role matching and onboarding
- Travel and housing coordination
- Consultant pipeline management
CTA: "Join the Consultant Network"
CTA href: "#consultants"

**Closing note under the cards:**

"These tools are developed from real operational experience and built to support
properties during recovery, transition, and growth — not to replace the systems
already in place."

---

### Design Requirements

- Match the existing dark design system exactly
- Use the same card structure as the existing Services section for visual consistency
- Cards should be in a 2x2 grid on desktop, stacked on mobile
- Each card should feel like a peer to the Services cards — same weight, same style
- Do not use fake UI screenshots or mockup images
- Do not use icons unless the existing design already uses them in that context
- The section should feel operational and credible, not like a startup product page

### Navigation

Add "Systems" to the existing navigation bar.

Find the nav link group in index.html and add:
```html
<a href="#systems">Systems</a>
```
Place it after the "Services" nav link.

### styles.css Changes

Add only the styles needed for the new section. Follow existing CSS conventions:
- Use the same CSS custom properties (variables) already defined
- Use the same class naming patterns already in use
- Do not create a new design language — extend what exists
- Add new styles at the bottom of styles.css in a clearly commented block:
  ```css
  /* ============================================================
     Systems Section — added [date]
     ============================================================ */
  ```

### Build Script

Confirm `scripts/build.js` copies `index.html` and `styles.css` to `dist/`.
If it does, no changes needed. If not, update it.

---

## CONSTRAINTS

- index.html, styles.css, and scripts/build.js only for Part B
- server.js must NOT be modified
- No new npm dependencies
- The nav change must not break mobile navigation behavior
- All copy must match the tone guidelines: direct, operator-focused, no buzzwords
- Do not invent capabilities not listed above
- Do not add testimonials, client logos, or metrics

---

## DELIVERABLES

Part A:
1. Files moved and where they were moved to
2. What .gitignore additions were made
3. What remains in docs/strategy/ after cleanup
4. Contents of data/inquiries.jsonl (confirm it was test data before removal)

Part B:
1. Confirmation that "Systems" nav link was added
2. Confirmation that all four product family cards are in the section
3. Description of any new CSS classes added
4. Result of npm run build
5. Visual check instructions (how to verify the section looks right locally)
6. Confirmation that the public inquiry form and admin pages are unaffected
