from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

base = Path("/mnt/data/fullstacks_docs_pack")
(base / "strategy").mkdir(parents=True, exist_ok=True)
(base / "products").mkdir(exist_ok=True)
(base / "sales").mkdir(exist_ok=True)
(base / "technical").mkdir(exist_ok=True)
(base / "pilot").mkdir(exist_ok=True)

docs = {
    "strategy/fullstacks-roadmap.md": """# FullStacks Roadmap

## Phase 1 (0-6 Months)
- Launch hospitality-first website
- Consultant onboarding
- Client/property intake
- Recovery Board pilot
- Weekly owner reporting pilot
- First management company partnerships

## Phase 2 (6-18 Months)
- Multi-property reporting
- Vendor tracking
- Assignment management
- Consultant deployment workflows

## Phase 3 (18-36 Months)
- Regional consultant network
- Multi-client operations platform
- Hospitality systems portfolio
- National task force support capability
""",
    "strategy/consultant-network.md": """# Consultant Network Strategy

Goal: Build a vetted network of hospitality professionals.

Roles:
- Task Force GM
- Operations Manager
- Revenue Specialist
- Executive Housekeeper
- Maintenance Leader

Process:
1. Intake
2. Vetting
3. Availability Tracking
4. Assignment Matching
5. Deployment
6. Performance Review
""",
    "strategy/luminous-pilot-strategy.md": """# Luminous Pilot Strategy

Objective:
Validate operational tools inside a real hospitality environment.

Pilot Modules:
- Recovery Board
- Vendor Tracker
- Weekly Owner Reporting
- Property Recovery Dashboard

Success Metrics:
- Reduced spreadsheet dependency
- Faster issue visibility
- Improved follow-through
- Better reporting consistency

Initial Ask:
Request feedback, adoption, and operational validation rather than software purchase.
""",
    "products/recovery-suite.md": """# FullStacks Recovery

Modules:
- OOO Recovery Board
- Vendor Tracker
- Inspection Readiness
- Return-to-Service Workflow
- CapEx Tracking

Audience:
Distressed, transitioning, or underperforming hotels.
""",
    "products/operations-suite.md": """# FullStacks Operations

Modules:
- Scheduling
- Availability Tracking
- Shift Coverage
- Department Checklists
- Handoff Tracking
- Accountability Systems

Audience:
Hotel operators and management companies.
""",
    "products/reporting-suite.md": """# FullStacks Reporting

Modules:
- Weekly Owner Reports
- AR Visibility
- Labor Visibility
- Inventory Visibility
- KPI Dashboards

Purpose:
Operational visibility layered around existing systems.
""",
    "products/task-force-suite.md": """# FullStacks Task Force

Modules:
- Consultant Availability
- Assignment Tracking
- Deployment Planning
- Coverage Board
- Consultant Pipeline

Purpose:
Support a scalable hospitality consulting network.
""",
    "sales/management-company-pitch.md": """# Management Company Pitch

FullStacks provides:
- Task force leadership
- Property recovery
- Reporting visibility
- Operational systems

We support management companies during transitions, staffing gaps, and operational pressure.
""",
    "sales/ownership-group-pitch.md": """# Ownership Group Pitch

Focus:
- Revenue visibility
- Property recovery
- Leadership continuity
- Operational stabilization

Outcome:
Faster visibility and stronger execution.
""",
    "sales/consultant-recruiting.md": """# Consultant Recruiting

Message:
Join a growing network of hospitality professionals supporting hotels through recovery, transition, and operational improvement.

Target Roles:
Task Force GM, Revenue, Housekeeping, Maintenance, Operations.
""",
    "sales/pilot-proposal.md": """# Pilot Proposal

Pilot Name:
Operational Visibility Pilot

Modules:
- Recovery Board
- Vendor Tracking
- Weekly Reporting

Goal:
Validate usefulness before commercialization.
""",
    "technical/database-architecture.md": """# Database Architecture

Core Tables:
- consultant_applications
- client_inquiries
- recovery_items
- vendors
- projects
- assignments
- owner_reports

Database:
PostgreSQL on Railway.
""",
    "technical/consultant-schema.md": """# Consultant Schema

Fields:
- name
- email
- phone
- location
- experience
- specialty
- availability
- status
""",
    "technical/client-schema.md": """# Client Schema

Fields:
- property_name
- company
- contact
- challenge
- urgency
- status
- notes
""",
    "technical/railway-deployment.md": """# Railway Deployment

Requirements:
- DATABASE_URL
- Build Script
- Start Script
- Production Environment

Use Railway PostgreSQL for persistence.
""",
    "pilot/phase-1-pilot.md": """# Phase 1 Pilot

Property Focus:
Single hotel pilot.

Modules:
- Recovery Board
- Vendor Tracker
- Weekly Reporting

Objective:
Operational validation.
""",
    "pilot/recovery-board.md": """# Recovery Board

Track:
- Room Number
- Issue
- Priority
- Owner
- Vendor
- Status
- Estimated Completion
- Return To Service
""",
    "pilot/owner-reporting.md": """# Owner Reporting

Sections:
- Revenue
- Labor
- OOO Inventory
- Projects
- Risks
- Priorities
- Staffing
""",
    "pilot/success-metrics.md": """# Success Metrics

Measure:
- Reporting time saved
- Spreadsheet reduction
- Follow-up completion
- Vendor responsiveness
- OOO recovery visibility
"""
}

for rel, content in docs.items():
    p = base / rel
    p.write_text(content)

zip_path = "/mnt/data/FullStacks_Docs_Pack.zip"
with ZipFile(zip_path, "w", ZIP_DEFLATED) as z:
    for f in base.rglob("*"):
        if f.is_file():
            z.write(f, f.relative_to(base))

print(zip_path)
