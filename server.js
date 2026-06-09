const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
const publicDir = path.join(__dirname, "dist");
const maxBodySize = 64 * 1024;
const databaseUrl = process.env.DATABASE_URL;
const adminAccessToken = cleanString(process.env.ADMIN_ACCESS_TOKEN);
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 10000,
      ssl: databaseUrl.includes("railway.internal") ? false : { rejectUnauthorized: false }
    })
  : null;
let databaseReady = false;

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 5;            // per IP per window

class RateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map(); // ip -> [timestamp, ...]
  }

  isAllowed(ip) {
    if (!ip) {
      return true; // fail open — allow requests with no identifiable IP
    }

    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Filter out expired timestamps inline — cleans up as we go
    const timestamps = (this.requests.get(ip) || []).filter((t) => t > windowStart);

    if (timestamps.length >= this.maxRequests) {
      this.requests.set(ip, timestamps);
      return false;
    }

    timestamps.push(now);
    this.requests.set(ip, timestamps);
    return true;
  }
}

const rateLimiter = new RateLimiter(RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS);

function setSecurityHeaders(res, isHtml) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (isHtml) {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'"
    );
  }
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const fieldLimits = {
  name: 120,
  email: 180,
  phone: 60,
  company: 180,
  propertyName: 180,
  propertyLocation: 180,
  brandFlag: 160,
  roomCount: 40,
  propertyRelationship: 160,
  currentChallenge: 120,
  urgency: 120,
  message: 4000,
  firstName: 120,
  lastName: 120,
  city: 120,
  state: 80,
  currentRole: 180,
  yearsExperience: 40,
  travelPreference: 80,
  availability: 120,
  brandsWorkedWith: 500,
  managementCompanies: 500,
  linkedinUrl: 260,
  resumeUrl: 500,
  compensationExpectations: 240,
  notes: 4000
};

const travelOptions = new Set(["Local Only", "Regional", "Nationwide"]);
const availabilityOptions = new Set([
  "Immediately Available",
  "Available Within 2 Weeks",
  "Available Within 30 Days",
  "Currently Employed / Future Opportunities",
  "Project-Based Only"
]);
const specialtyOptions = new Set([
  "Task Force GM",
  "Operations",
  "Revenue Management",
  "Housekeeping",
  "Maintenance",
  "Front Office",
  "Sales",
  "Opening Support",
  "Property Recovery",
  "Reporting / Systems"
]);
const applicationStatuses = [
  "New",
  "Reviewing",
  "Interview",
  "Qualified",
  "Available",
  "Placed",
  "Inactive",
  "Rejected"
];
const applicationStatusOptions = new Set(applicationStatuses);

const inquiryStatuses = [
  "New",
  "Reviewing",
  "Contacted",
  "Qualified",
  "Proposal",
  "Active",
  "Closed",
  "Lost",
  "Archived"
];
const inquiryStatusOptions = new Set(inquiryStatuses);

function sendJson(res, statusCode, payload) {
  setSecurityHeaders(res, false);
  res.writeHead(statusCode, { "Content-Type": contentTypes[".json"] });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > maxBodySize) {
        reject(new Error("body_too_large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("malformed_json"));
      }
    });

    req.on("error", reject);
  });
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidOptionalUrl(url) {
  if (!url) {
    return true;
  }

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
  } catch (error) {
    return false;
  }
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  if (typeof req.headers["x-real-ip"] === "string") {
    return req.headers["x-real-ip"].trim();
  }

  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : "";
}

function timingSafeTokenMatches(candidate, expected) {
  if (!candidate || !expected) {
    return false;
  }

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  if (candidateBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
}

function getAdminToken(req) {
  const authorization = cleanString(req.headers.authorization);

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return cleanString(req.headers["x-admin-token"]);
}

function isAuthorizedAdminRequest(req) {
  return timingSafeTokenMatches(getAdminToken(req), adminAccessToken);
}

function requireAdmin(req, res) {
  if (!adminAccessToken) {
    sendJson(res, 503, { ok: false, error: "Admin access is not configured." });
    return false;
  }

  if (!isAuthorizedAdminRequest(req)) {
    sendJson(res, 401, { ok: false, error: "Unauthorized." });
    return false;
  }

  return true;
}

// Used by CSV export routes: accepts Bearer header OR ?token= query param
// so the browser can trigger a native file download without fetch()
function requireAdminOrQueryToken(req, res, parsedUrl) {
  if (!adminAccessToken) {
    sendJson(res, 503, { ok: false, error: "Admin access is not configured." });
    return false;
  }

  const queryToken = cleanString(parsedUrl.searchParams.get("token"));
  const authorized =
    isAuthorizedAdminRequest(req) ||
    (queryToken.length > 0 && timingSafeTokenMatches(queryToken, adminAccessToken));

  if (!authorized) {
    sendJson(res, 401, { ok: false, error: "Unauthorized." });
    return false;
  }

  return true;
}

function mapConsultantApplication(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    firstName: row.first_name,
    lastName: row.last_name,
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    phone: row.phone,
    city: row.city,
    state: row.state,
    currentRole: row.current_hospitality_role,
    yearsExperience: row.years_experience,
    travelPreference: row.travel_preference,
    availability: row.availability,
    brandsWorkedWith: row.brands_worked_with,
    managementCompanies: row.management_companies,
    linkedinUrl: row.linkedin_url,
    resumeUrl: row.resume_url,
    compensationExpectations: row.compensation_expectations,
    specialtyAreas: Array.isArray(row.specialty_areas) ? row.specialty_areas : [],
    notes: row.notes,
    status: row.status || "New"
  };
}

function mapInquiry(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    propertyName: row.property_name,
    propertyLocation: row.property_location,
    brandFlag: row.brand_flag,
    roomCount: row.room_count,
    propertyRelationship: row.property_relationship,
    currentChallenge: row.current_challenge,
    urgency: row.urgency,
    message: row.message,
    internalNotes: row.internal_notes,
    status: row.status || "New"
  };
}

// ============================================================
// Email Notifications — Resend
// Required environment variables:
// NOTIFICATION_EMAIL_TO   — Admin email address to receive notifications
// NOTIFICATION_EMAIL_FROM — Verified sender address (must match your Resend domain)
// RESEND_API_KEY          — API key from resend.com
//
// If any of these are missing, email notifications are disabled silently.
// The site will still function normally without email configured.
// ============================================================

const resendApiKey = process.env.RESEND_API_KEY || "";
const notificationEmailTo = (process.env.NOTIFICATION_EMAIL_TO || "").trim();
const notificationEmailFrom = (process.env.NOTIFICATION_EMAIL_FROM || "").trim();
const emailEnabled = Boolean(resendApiKey && notificationEmailTo && notificationEmailFrom);
let resendClient = null;

if (emailEnabled) {
  const { Resend } = require("resend");
  resendClient = new Resend(resendApiKey);
  console.log(`Email notifications: enabled (sending to ${notificationEmailTo})`);
} else {
  console.log("Email notifications: disabled (RESEND_API_KEY not set)");
}

async function sendNewInquiryNotification(record) {
  if (!emailEnabled || !resendClient) {
    return;
  }

  const submittedAt = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date());

  const subject = `New Property Inquiry — ${record.propertyName || record.company || "Unknown"} — ${record.urgency || "Unknown urgency"}`;

  const text = [
    "New property support inquiry submitted on FullStacks.ink",
    "",
    "CONTACT",
    `Name: ${record.name}`,
    `Email: ${record.email}`,
    `Phone: ${record.phone || "Not provided"}`,
    `Company: ${record.company || "Not provided"}`,
    "",
    "PROPERTY",
    `Property Name: ${record.propertyName || "Not provided"}`,
    `Location: ${record.propertyLocation || "Not provided"}`,
    `Brand / Flag: ${record.brandFlag || "Not provided"}`,
    `Room Count: ${record.roomCount || "Not provided"}`,
    "",
    "INQUIRY",
    `Challenge: ${record.currentChallenge || "Not provided"}`,
    `Urgency: ${record.urgency || "Not provided"}`,
    "Message:",
    record.message || "",
    "",
    `Submitted: ${submittedAt}`,
    "",
    "Review this inquiry at: https://fullstacks.ink/admin/clients"
  ].join("\n");

  await resendClient.emails.send({
    from: notificationEmailFrom,
    to: notificationEmailTo,
    subject,
    text
  });
}

async function sendNewConsultantNotification(application) {
  if (!emailEnabled || !resendClient) {
    return;
  }

  const submittedAt = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date());

  const subject = `New Consultant Application — ${application.firstName} ${application.lastName} — ${application.currentRole}`;

  const specialties =
    application.specialtyAreas && application.specialtyAreas.length > 0
      ? application.specialtyAreas.join(", ")
      : "Not provided";

  const text = [
    "New consultant application submitted on FullStacks.ink",
    "",
    "APPLICANT",
    `Name: ${application.firstName} ${application.lastName}`,
    `Email: ${application.email}`,
    `Phone: ${application.phone}`,
    `Location: ${application.city}, ${application.state}`,
    "",
    "EXPERIENCE",
    `Current Role: ${application.currentRole}`,
    `Years Experience: ${application.yearsExperience}`,
    `Travel Preference: ${application.travelPreference}`,
    `Availability: ${application.availability}`,
    "",
    "SPECIALTIES",
    specialties,
    "",
    `Submitted: ${submittedAt}`,
    "",
    "Review this application at: https://fullstacks.ink/admin/consultants"
  ].join("\n");

  await resendClient.emails.send({
    from: notificationEmailFrom,
    to: notificationEmailTo,
    subject,
    text
  });
}

async function runMigration(description, sql) {
  try {
    await pool.query(sql);
    return true;
  } catch (error) {
    console.error(`Database migration failed: ${description}`);
    console.error(error && error.message ? error.message : error);
    return false;
  }
}

async function initializeDatabase() {
  if (!pool) {
    console.warn("DATABASE_URL is not configured. Form submissions will return storage errors.");
    return false;
  }

  const migrations = [
    await runMigration(
      "create inquiries table",
      `
    CREATE TABLE IF NOT EXISTS inquiries (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      company TEXT,
      inquiry_type TEXT NOT NULL,
      urgency TEXT,
      message TEXT NOT NULL,
      source TEXT DEFAULT 'fullstacks.ink',
      user_agent TEXT,
      ip TEXT
    )
  `
    ),
    await runMigration(
      "add property support inquiry columns",
      `
    ALTER TABLE inquiries
      ADD COLUMN IF NOT EXISTS property_name TEXT,
      ADD COLUMN IF NOT EXISTS property_location TEXT,
      ADD COLUMN IF NOT EXISTS brand_flag TEXT,
      ADD COLUMN IF NOT EXISTS room_count TEXT,
      ADD COLUMN IF NOT EXISTS property_relationship TEXT,
      ADD COLUMN IF NOT EXISTS current_challenge TEXT
  `
    ),
    await runMigration(
      "create consultant applications table",
      `
    CREATE TABLE IF NOT EXISTS consultant_applications (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      current_hospitality_role TEXT NOT NULL,
      years_experience TEXT NOT NULL,
      travel_preference TEXT NOT NULL,
      availability TEXT NOT NULL,
      brands_worked_with TEXT,
      management_companies TEXT,
      linkedin_url TEXT,
      resume_url TEXT,
      compensation_expectations TEXT,
      specialty_areas TEXT[],
      notes TEXT NOT NULL,
      status TEXT DEFAULT 'New',
      source TEXT DEFAULT 'fullstacks.ink',
      user_agent TEXT,
      ip TEXT
    )
  `
    ),
    await runMigration(
      "index consultant applications by created date",
      `
    CREATE INDEX IF NOT EXISTS consultant_applications_created_at_idx
      ON consultant_applications (created_at DESC)
  `
    ),
    await runMigration(
      "add consultant application status column",
      `
    ALTER TABLE consultant_applications
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'New'
  `
    ),
    await runMigration(
      "backfill consultant application status",
      `
    UPDATE consultant_applications
      SET status = 'New'
      WHERE status IS NULL
  `
    ),
    await runMigration(
      "index consultant applications by status",
      `
    CREATE INDEX IF NOT EXISTS consultant_applications_status_idx
      ON consultant_applications (status)
  `
    ),
    await runMigration(
      "index consultant applications by email",
      `
    CREATE INDEX IF NOT EXISTS consultant_applications_email_idx
      ON consultant_applications (email)
  `
    ),
    await runMigration(
      "index consultant applications by state",
      `
    CREATE INDEX IF NOT EXISTS consultant_applications_state_idx
      ON consultant_applications (state)
  `
    ),
    await runMigration(
      "index consultant applications by travel preference",
      `
    CREATE INDEX IF NOT EXISTS consultant_applications_travel_preference_idx
      ON consultant_applications (travel_preference)
  `
    ),
    await runMigration(
      "index consultant applications by availability",
      `
    CREATE INDEX IF NOT EXISTS consultant_applications_availability_idx
      ON consultant_applications (availability)
  `
    ),
    await runMigration(
      "add inquiry status column",
      `ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'New'`
    ),
    await runMigration(
      "add inquiry internal notes column",
      `ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS internal_notes TEXT`
    ),
    await runMigration(
      "add inquiry updated_at column",
      `ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`
    ),
    await runMigration(
      "index inquiries by status",
      `CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status)`
    ),
    await runMigration(
      "index inquiries by created_at",
      `CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at DESC)`
    ),
    await runMigration(
      "index inquiries by urgency",
      `CREATE INDEX IF NOT EXISTS idx_inquiries_urgency ON inquiries(urgency)`
    )
  ];

  databaseReady = migrations.every(Boolean);

  if (!databaseReady) {
    console.warn("Database initialization completed with errors. Site will serve, but form storage may fail.");
  } else {
    console.log("Database initialization completed successfully.");
  }

  return databaseReady;
}

function validateInquiry(payload) {
  const inquiry = {
    name: cleanString(payload.name),
    email: cleanString(payload.email),
    phone: cleanString(payload.phone),
    company: cleanString(payload.company),
    propertyName: cleanString(payload.propertyName),
    propertyLocation: cleanString(payload.propertyLocation),
    brandFlag: cleanString(payload.brandFlag),
    roomCount: cleanString(payload.roomCount),
    propertyRelationship: cleanString(payload.propertyRelationship),
    currentChallenge: cleanString(payload.currentChallenge),
    urgency: cleanString(payload.urgency),
    message: cleanString(payload.message),
    website: cleanString(payload.website)
  };

  if (inquiry.website) {
    return { ok: true, spam: true, inquiry };
  }

  const requiredFields = [
    "name",
    "email",
    "phone",
    "company",
    "propertyName",
    "propertyLocation",
    "currentChallenge",
    "urgency",
    "message"
  ];
  const missing = requiredFields.filter((field) => !inquiry[field]);

  if (missing.length > 0) {
    return { ok: false, error: "Missing required fields." };
  }

  if (!isValidEmail(inquiry.email)) {
    return { ok: false, error: "Invalid email address." };
  }

  for (const [field, limit] of Object.entries(fieldLimits)) {
    if (inquiry[field] && inquiry[field].length > limit) {
      return { ok: false, error: `${field} exceeds maximum length.` };
    }
  }

  return { ok: true, spam: false, inquiry };
}

async function handleInquiry(req, res) {
  if (!rateLimiter.isAllowed(getClientIp(req))) {
    console.log("Rate limit exceeded for submission endpoint");
    sendJson(res, 429, { ok: false, error: "Too many submissions. Please try again later." });
    return;
  }

  let payload;

  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: "Invalid JSON request." });
    return;
  }

  const validation = validateInquiry(payload);

  if (!validation.ok) {
    sendJson(res, 400, { ok: false, error: validation.error });
    return;
  }

  if (validation.spam) {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (!pool || !databaseReady) {
    sendJson(res, 503, { ok: false, error: "Inquiry storage is not configured." });
    return;
  }

  const record = {
    name: validation.inquiry.name,
    email: validation.inquiry.email,
    phone: validation.inquiry.phone,
    company: validation.inquiry.company,
    propertyName: validation.inquiry.propertyName,
    propertyLocation: validation.inquiry.propertyLocation,
    brandFlag: validation.inquiry.brandFlag,
    roomCount: validation.inquiry.roomCount,
    propertyRelationship: validation.inquiry.propertyRelationship,
    currentChallenge: validation.inquiry.currentChallenge,
    urgency: validation.inquiry.urgency,
    message: validation.inquiry.message,
    source: "fullstacks.ink",
    userAgent: cleanString(req.headers["user-agent"]),
    ip: getClientIp(req)
  };

  try {
    await pool.query(
      `
        INSERT INTO inquiries (
          name,
          email,
          phone,
          company,
          property_name,
          property_location,
          brand_flag,
          room_count,
          property_relationship,
          current_challenge,
          inquiry_type,
          urgency,
          message,
          source,
          user_agent,
          ip
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `,
      [
        record.name,
        record.email,
        record.phone,
        record.company,
        record.propertyName,
        record.propertyLocation,
        record.brandFlag || null,
        record.roomCount || null,
        record.propertyRelationship || null,
        record.currentChallenge,
        "Property support",
        record.urgency,
        record.message,
        record.source,
        record.userAgent || null,
        record.ip || null
      ]
    );
    // Fire notification — do not await, do not block response
    sendNewInquiryNotification(record).catch((err) => {
      console.error("Email notification failed:", err.message);
    });
    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: "Unable to save inquiry." });
  }
}

function validateConsultantApplication(payload) {
  const application = {
    firstName: cleanString(payload.firstName),
    lastName: cleanString(payload.lastName),
    email: cleanString(payload.email),
    phone: cleanString(payload.phone),
    city: cleanString(payload.city),
    state: cleanString(payload.state),
    currentRole: cleanString(payload.currentRole),
    yearsExperience: cleanString(payload.yearsExperience),
    travelPreference: cleanString(payload.travelPreference),
    availability: cleanString(payload.availability),
    brandsWorkedWith: cleanString(payload.brandsWorkedWith),
    managementCompanies: cleanString(payload.managementCompanies),
    linkedinUrl: cleanString(payload.linkedinUrl),
    resumeUrl: cleanString(payload.resumeUrl),
    compensationExpectations: cleanString(payload.compensationExpectations),
    specialtyAreas: Array.isArray(payload.specialtyAreas)
      ? payload.specialtyAreas.map(cleanString).filter(Boolean)
      : [],
    notes: cleanString(payload.notes),
    website: cleanString(payload.website)
  };

  if (application.website) {
    return { ok: true, spam: true, application };
  }

  const requiredFields = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "city",
    "state",
    "currentRole",
    "yearsExperience",
    "travelPreference",
    "availability",
    "notes"
  ];
  const missing = requiredFields.filter((field) => !application[field]);

  if (missing.length > 0) {
    return { ok: false, error: "Missing required fields." };
  }

  if (!isValidEmail(application.email)) {
    return { ok: false, error: "Invalid email address." };
  }

  if (!travelOptions.has(application.travelPreference)) {
    return { ok: false, error: "Invalid travel preference." };
  }

  if (!availabilityOptions.has(application.availability)) {
    return { ok: false, error: "Invalid availability." };
  }

  if (application.specialtyAreas.some((specialty) => !specialtyOptions.has(specialty))) {
    return { ok: false, error: "Invalid specialty area." };
  }

  if (!isValidOptionalUrl(application.linkedinUrl) || !isValidOptionalUrl(application.resumeUrl)) {
    return { ok: false, error: "Invalid URL." };
  }

  for (const [field, limit] of Object.entries(fieldLimits)) {
    if (application[field] && application[field].length > limit) {
      return { ok: false, error: `${field} exceeds maximum length.` };
    }
  }

  return { ok: true, spam: false, application };
}

async function handleConsultantApplication(req, res) {
  if (!rateLimiter.isAllowed(getClientIp(req))) {
    console.log("Rate limit exceeded for submission endpoint");
    sendJson(res, 429, { ok: false, error: "Too many submissions. Please try again later." });
    return;
  }

  let payload;

  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: "Invalid JSON request." });
    return;
  }

  const validation = validateConsultantApplication(payload);

  if (!validation.ok) {
    sendJson(res, 400, { ok: false, error: validation.error });
    return;
  }

  if (validation.spam) {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (!pool || !databaseReady) {
    sendJson(res, 503, { ok: false, error: "Consultant application storage is not configured." });
    return;
  }

  const application = validation.application;

  // Duplicate email check — must run before INSERT, after validation
  try {
    const existing = await pool.query(
      "SELECT id FROM consultant_applications WHERE email = $1 LIMIT 1",
      [application.email]
    );
    if (existing.rowCount > 0) {
      sendJson(res, 409, { ok: false, error: "An application with this email address already exists." });
      return;
    }
  } catch (error) {
    sendJson(res, 500, { ok: false, error: "Unable to process application." });
    return;
  }

  try {
    await pool.query(
      `
        INSERT INTO consultant_applications (
          first_name,
          last_name,
          email,
          phone,
          city,
          state,
          current_hospitality_role,
          years_experience,
          travel_preference,
          availability,
          brands_worked_with,
          management_companies,
          linkedin_url,
          resume_url,
          compensation_expectations,
          specialty_areas,
          notes,
          status,
          source,
          user_agent,
          ip
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      `,
      [
        application.firstName,
        application.lastName,
        application.email,
        application.phone,
        application.city,
        application.state,
        application.currentRole,
        application.yearsExperience,
        application.travelPreference,
        application.availability,
        application.brandsWorkedWith || null,
        application.managementCompanies || null,
        application.linkedinUrl || null,
        application.resumeUrl || null,
        application.compensationExpectations || null,
        application.specialtyAreas,
        application.notes,
        "New",
        "fullstacks.ink",
        cleanString(req.headers["user-agent"]) || null,
        getClientIp(req) || null
      ]
    );
    // Fire notification — do not await, do not block response
    sendNewConsultantNotification(application).catch((err) => {
      console.error("Email notification failed:", err.message);
    });
    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: "Unable to save consultant application." });
  }
}

// RFC 4180 CSV helpers — no external dependency needed
function escapeCsvField(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function buildCsvRow(fields) {
  return fields.map(escapeCsvField).join(",");
}

async function handleExportConsultantApplicationsCsv(req, res, parsedUrl) {
  if (!requireAdminOrQueryToken(req, res, parsedUrl)) {
    return;
  }

  if (!pool || !databaseReady) {
    sendJson(res, 503, { ok: false, error: "Consultant application storage is not configured." });
    return;
  }

  const filters = [];
  const params = [];

  function addFilter(sql, value) {
    params.push(value);
    filters.push(sql.replace("?", `$${params.length}`));
  }

  const status = cleanString(parsedUrl.searchParams.get("status"));
  const state = cleanString(parsedUrl.searchParams.get("state"));
  const travelPreference = cleanString(parsedUrl.searchParams.get("travelPreference"));
  const availability = cleanString(parsedUrl.searchParams.get("availability"));
  const specialtyArea = cleanString(parsedUrl.searchParams.get("specialtyArea"));
  const keyword = cleanString(parsedUrl.searchParams.get("q"));

  if (status) { addFilter("status = ?", status); }
  if (state) { addFilter("state ILIKE ?", state); }
  if (travelPreference) { addFilter("travel_preference = ?", travelPreference); }
  if (availability) { addFilter("availability = ?", availability); }
  if (specialtyArea) { addFilter("? = ANY(COALESCE(specialty_areas, ARRAY[]::TEXT[]))", specialtyArea); }

  if (keyword) {
    params.push(`%${keyword}%`);
    const placeholder = `$${params.length}`;
    filters.push(`(
      first_name ILIKE ${placeholder}
      OR last_name ILIKE ${placeholder}
      OR email ILIKE ${placeholder}
      OR current_hospitality_role ILIKE ${placeholder}
      OR notes ILIKE ${placeholder}
    )`);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const today = new Date().toISOString().slice(0, 10);

  try {
    const result = await pool.query(
      `
        SELECT
          id, created_at, first_name, last_name, email, phone, city, state,
          current_hospitality_role, years_experience, travel_preference, availability,
          specialty_areas, brands_worked_with, management_companies, linkedin_url,
          resume_url, compensation_expectations, status, notes
        FROM consultant_applications
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT 10000
      `,
      params
    );

    const headerRow = buildCsvRow([
      "id", "created_at", "first_name", "last_name", "email", "phone",
      "city", "state", "current_hospitality_role", "years_experience",
      "travel_preference", "availability", "specialty_areas", "brands_worked_with",
      "management_companies", "linkedin_url", "resume_url", "compensation_expectations",
      "status", "notes"
    ]);

    const dataRows = result.rows.map((row) =>
      buildCsvRow([
        row.id,
        row.created_at ? row.created_at.toISOString() : "",
        row.first_name,
        row.last_name,
        row.email,
        row.phone,
        row.city,
        row.state,
        row.current_hospitality_role,
        row.years_experience,
        row.travel_preference,
        row.availability,
        Array.isArray(row.specialty_areas) ? row.specialty_areas.join(";") : "",
        row.brands_worked_with,
        row.management_companies,
        row.linkedin_url,
        row.resume_url,
        row.compensation_expectations,
        row.status,
        row.notes
      ])
    );

    const csv = [headerRow, ...dataRows].join("\r\n");

    setSecurityHeaders(res, false);
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="consultant-applications-${today}.csv"`,
      "Cache-Control": "no-cache"
    });
    res.end(csv);
  } catch (error) {
    sendJson(res, 500, { ok: false, error: "Unable to export consultant applications." });
  }
}

async function handleListConsultantApplications(req, res, parsedUrl) {
  if (!requireAdmin(req, res)) {
    return;
  }

  if (!pool || !databaseReady) {
    sendJson(res, 503, { ok: false, error: "Consultant application storage is not configured." });
    return;
  }

  const filters = [];
  const params = [];

  function addFilter(sql, value) {
    params.push(value);
    filters.push(sql.replace("?", `$${params.length}`));
  }

  const status = cleanString(parsedUrl.searchParams.get("status"));
  const state = cleanString(parsedUrl.searchParams.get("state"));
  const travelPreference = cleanString(parsedUrl.searchParams.get("travelPreference"));
  const availability = cleanString(parsedUrl.searchParams.get("availability"));
  const specialtyArea = cleanString(parsedUrl.searchParams.get("specialtyArea"));
  const keyword = cleanString(parsedUrl.searchParams.get("q"));
  const limitParam = parseInt(parsedUrl.searchParams.get("limit"), 10);
  const offsetParam = parseInt(parsedUrl.searchParams.get("offset"), 10);
  const limit = !isNaN(limitParam) && limitParam > 0 && limitParam <= 200 ? limitParam : 50;
  const offset = !isNaN(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

  if (status) { addFilter("status = ?", status); }
  if (state) { addFilter("state ILIKE ?", state); }
  if (travelPreference) { addFilter("travel_preference = ?", travelPreference); }
  if (availability) { addFilter("availability = ?", availability); }
  if (specialtyArea) { addFilter("? = ANY(COALESCE(specialty_areas, ARRAY[]::TEXT[]))", specialtyArea); }

  if (keyword) {
    params.push(`%${keyword}%`);
    const placeholder = `$${params.length}`;
    filters.push(`(
      first_name ILIKE ${placeholder}
      OR last_name ILIKE ${placeholder}
      OR email ILIKE ${placeholder}
      OR current_hospitality_role ILIKE ${placeholder}
      OR notes ILIKE ${placeholder}
    )`);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM consultant_applications ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit);
    params.push(offset);

    const result = await pool.query(
      `
        SELECT
          id,
          created_at,
          first_name,
          last_name,
          email,
          phone,
          city,
          state,
          current_hospitality_role,
          years_experience,
          travel_preference,
          availability,
          brands_worked_with,
          management_companies,
          linkedin_url,
          resume_url,
          compensation_expectations,
          specialty_areas,
          notes,
          status
        FROM consultant_applications
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params
    );

    sendJson(res, 200, {
      ok: true,
      statuses: applicationStatuses,
      consultants: result.rows.map(mapConsultantApplication),
      total,
      limit,
      offset,
      hasMore: offset + result.rows.length < total
    });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: "Unable to load consultant applications." });
  }
}

async function handleUpdateConsultantApplicationStatus(req, res, applicationId) {
  if (!requireAdmin(req, res)) {
    return;
  }

  if (!/^\d+$/.test(applicationId)) {
    sendJson(res, 400, { ok: false, error: "Invalid application ID." });
    return;
  }

  let payload;

  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: "Invalid JSON request." });
    return;
  }

  const status = cleanString(payload.status);

  if (!applicationStatusOptions.has(status)) {
    sendJson(res, 400, { ok: false, error: "Invalid application status." });
    return;
  }

  if (!pool || !databaseReady) {
    sendJson(res, 503, { ok: false, error: "Consultant application storage is not configured." });
    return;
  }

  try {
    const result = await pool.query(
      `
        UPDATE consultant_applications
        SET status = $1
        WHERE id = $2
        RETURNING
          id,
          created_at,
          first_name,
          last_name,
          email,
          phone,
          city,
          state,
          current_hospitality_role,
          years_experience,
          travel_preference,
          availability,
          brands_worked_with,
          management_companies,
          linkedin_url,
          resume_url,
          compensation_expectations,
          specialty_areas,
          notes,
          status
      `,
      [status, applicationId]
    );

    if (result.rowCount === 0) {
      sendJson(res, 404, { ok: false, error: "Consultant application not found." });
      return;
    }

    sendJson(res, 200, { ok: true, application: mapConsultantApplication(result.rows[0]) });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: "Unable to update consultant application status." });
  }
}

async function handleListInquiries(req, res, parsedUrl) {
  if (!requireAdmin(req, res)) {
    return;
  }

  if (!pool || !databaseReady) {
    sendJson(res, 503, { ok: false, error: "Inquiry storage is not configured." });
    return;
  }

  const filters = [];
  const params = [];

  function addFilter(sql, value) {
    params.push(value);
    filters.push(sql.replace("?", `$${params.length}`));
  }

  const status = cleanString(parsedUrl.searchParams.get("status"));
  const urgency = cleanString(parsedUrl.searchParams.get("urgency"));
  const challenge = cleanString(parsedUrl.searchParams.get("challenge"));
  const keyword = cleanString(parsedUrl.searchParams.get("q"));
  const limitParam = parseInt(parsedUrl.searchParams.get("limit"), 10);
  const offsetParam = parseInt(parsedUrl.searchParams.get("offset"), 10);
  const limit = !isNaN(limitParam) && limitParam > 0 && limitParam <= 200 ? limitParam : 50;
  const offset = !isNaN(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

  if (status) {
    addFilter("status = ?", status);
  }

  if (urgency) {
    addFilter("urgency = ?", urgency);
  }

  if (challenge) {
    addFilter("current_challenge ILIKE ?", `%${challenge}%`);
  }

  if (keyword) {
    params.push(`%${keyword}%`);
    const placeholder = `$${params.length}`;
    filters.push(`(
      name ILIKE ${placeholder}
      OR email ILIKE ${placeholder}
      OR company ILIKE ${placeholder}
      OR property_name ILIKE ${placeholder}
      OR message ILIKE ${placeholder}
    )`);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM inquiries ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit);
    params.push(offset);

    const result = await pool.query(
      `
        SELECT
          id,
          created_at,
          updated_at,
          name,
          email,
          phone,
          company,
          property_name,
          property_location,
          brand_flag,
          room_count,
          property_relationship,
          current_challenge,
          urgency,
          message,
          status,
          internal_notes
        FROM inquiries
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params
    );

    sendJson(res, 200, {
      ok: true,
      statuses: inquiryStatuses,
      inquiries: result.rows.map(mapInquiry),
      total,
      limit,
      offset,
      hasMore: offset + result.rows.length < total
    });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: "Unable to load inquiries." });
  }
}

async function handleExportInquiriesCsv(req, res, parsedUrl) {
  if (!requireAdminOrQueryToken(req, res, parsedUrl)) {
    return;
  }

  if (!pool || !databaseReady) {
    sendJson(res, 503, { ok: false, error: "Inquiry storage is not configured." });
    return;
  }

  const filters = [];
  const params = [];

  function addFilter(sql, value) {
    params.push(value);
    filters.push(sql.replace("?", `$${params.length}`));
  }

  const status = cleanString(parsedUrl.searchParams.get("status"));
  const urgency = cleanString(parsedUrl.searchParams.get("urgency"));
  const challenge = cleanString(parsedUrl.searchParams.get("challenge"));

  if (status) { addFilter("status = ?", status); }
  if (urgency) { addFilter("urgency = ?", urgency); }
  if (challenge) { addFilter("current_challenge ILIKE ?", `%${challenge}%`); }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const today = new Date().toISOString().slice(0, 10);

  try {
    const result = await pool.query(
      `
        SELECT
          id, created_at, updated_at, name, email, phone, company,
          property_name, property_location, brand_flag, room_count,
          property_relationship, current_challenge, urgency, message,
          status, internal_notes
        FROM inquiries
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT 10000
      `,
      params
    );

    const headerRow = buildCsvRow([
      "id", "created_at", "updated_at", "name", "email", "phone", "company",
      "property_name", "property_location", "brand_flag", "room_count",
      "property_relationship", "current_challenge", "urgency", "message",
      "status", "internal_notes"
    ]);

    const dataRows = result.rows.map((row) =>
      buildCsvRow([
        row.id,
        row.created_at ? row.created_at.toISOString() : "",
        row.updated_at ? row.updated_at.toISOString() : "",
        row.name,
        row.email,
        row.phone,
        row.company,
        row.property_name,
        row.property_location,
        row.brand_flag,
        row.room_count,
        row.property_relationship,
        row.current_challenge,
        row.urgency,
        row.message,
        row.status,
        row.internal_notes
      ])
    );

    const csv = [headerRow, ...dataRows].join("\r\n");

    setSecurityHeaders(res, false);
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="property-inquiries-${today}.csv"`,
      "Cache-Control": "no-cache"
    });
    res.end(csv);
  } catch (error) {
    sendJson(res, 500, { ok: false, error: "Unable to export inquiries." });
  }
}

async function handleUpdateInquiryStatus(req, res, inquiryId) {
  if (!requireAdmin(req, res)) {
    return;
  }

  if (!/^\d+$/.test(inquiryId)) {
    sendJson(res, 400, { ok: false, error: "Invalid inquiry ID." });
    return;
  }

  let payload;

  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: "Invalid JSON request." });
    return;
  }

  const status = cleanString(payload.status);

  if (!inquiryStatusOptions.has(status)) {
    sendJson(res, 400, { ok: false, error: "Invalid inquiry status." });
    return;
  }

  if (!pool || !databaseReady) {
    sendJson(res, 503, { ok: false, error: "Inquiry storage is not configured." });
    return;
  }

  try {
    const result = await pool.query(
      `
        UPDATE inquiries
        SET status = $1, updated_at = NOW()
        WHERE id = $2
      `,
      [status, inquiryId]
    );

    if (result.rowCount === 0) {
      sendJson(res, 404, { ok: false, error: "Inquiry not found." });
      return;
    }

    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: "Unable to update inquiry status." });
  }
}

async function handleUpdateInquiryNotes(req, res, inquiryId) {
  if (!requireAdmin(req, res)) {
    return;
  }

  if (!/^\d+$/.test(inquiryId)) {
    sendJson(res, 400, { ok: false, error: "Invalid inquiry ID." });
    return;
  }

  let payload;

  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: "Invalid JSON request." });
    return;
  }

  const notes = cleanString(payload.notes);

  if (notes.length > 4000) {
    sendJson(res, 400, { ok: false, error: "Notes exceed maximum length of 4000 characters." });
    return;
  }

  if (!pool || !databaseReady) {
    sendJson(res, 503, { ok: false, error: "Inquiry storage is not configured." });
    return;
  }

  try {
    const result = await pool.query(
      `
        UPDATE inquiries
        SET internal_notes = $1, updated_at = NOW()
        WHERE id = $2
      `,
      [notes || null, inquiryId]
    );

    if (result.rowCount === 0) {
      sendJson(res, 404, { ok: false, error: "Inquiry not found." });
      return;
    }

    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: "Unable to update inquiry notes." });
  }
}

async function handleAdminSummary(req, res) {
  if (!requireAdmin(req, res)) return;

  try {
    const [inquiryStatusResult, consultantStatusResult, recentInquiriesResult, recentConsultantsResult] =
      await Promise.all([
        pool.query("SELECT status, COUNT(*) AS count FROM inquiries GROUP BY status"),
        pool.query("SELECT status, COUNT(*) AS count FROM consultant_applications GROUP BY status"),
        pool.query(
          "SELECT id, name, created_at, current_challenge, urgency, status FROM inquiries ORDER BY created_at DESC LIMIT 5"
        ),
        pool.query(
          "SELECT id, first_name, last_name, created_at, current_hospitality_role, status FROM consultant_applications ORDER BY created_at DESC LIMIT 5"
        ),
      ]);

    const inquiryByStatus = {};
    let inquiryTotal = 0;
    for (const row of inquiryStatusResult.rows) {
      const count = parseInt(row.count, 10);
      inquiryByStatus[row.status] = count;
      inquiryTotal += count;
    }

    const consultantByStatus = {};
    let consultantTotal = 0;
    for (const row of consultantStatusResult.rows) {
      const count = parseInt(row.count, 10);
      consultantByStatus[row.status] = count;
      consultantTotal += count;
    }

    sendJson(res, 200, {
      inquiries: {
        total: inquiryTotal,
        byStatus: inquiryByStatus,
        recent: recentInquiriesResult.rows.map((row) => ({
          id: row.id,
          name: row.name,
          createdAt: row.created_at,
          currentChallenge: row.current_challenge,
          urgency: row.urgency,
          status: row.status,
        })),
      },
      consultants: {
        total: consultantTotal,
        byStatus: consultantByStatus,
        recent: recentConsultantsResult.rows.map((row) => ({
          id: row.id,
          name: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
          createdAt: row.created_at,
          currentRole: row.current_hospitality_role,
          status: row.status,
        })),
      },
    });
  } catch (error) {
    console.error("Admin summary error:", error.message);
    sendJson(res, 500, { ok: false, error: "Unable to load summary." });
  }
}

async function handleHealth(req, res) {
  let dbOk = false;

  if (pool) {
    try {
      await Promise.race([
        pool.query("SELECT 1"),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("DB health check timeout")), 3000)
        )
      ]);
      dbOk = true;
    } catch {
      dbOk = false;
    }
  }

  sendJson(res, 200, { ok: true, db: dbOk, ts: new Date().toISOString() });
}

function resolveRequestPath(url) {
  const parsedUrl = new URL(url, `http://${HOST}`);
  const safePath = path.normalize(decodeURIComponent(parsedUrl.pathname)).replace(/^(\.\.[/\\])+/, "");
  const requestedPath = safePath === "/" ? "/index.html" : safePath;
  return path.join(publicDir, requestedPath);
}

function serveStatic(req, res) {
  if (!fs.existsSync(publicDir)) {
    setSecurityHeaders(res, false);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Build output not found. Run npm run build before npm run start.");
    return;
  }

  const filePath = resolveRequestPath(req.url || "/");

  if (!filePath.startsWith(publicDir)) {
    setSecurityHeaders(res, false);
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      // File not found — fall back to index.html (SPA behaviour)
      fs.readFile(path.join(publicDir, "index.html"), (fallbackError, fallbackData) => {
        if (fallbackError) {
          setSecurityHeaders(res, false);
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Not found");
          return;
        }

        setSecurityHeaders(res, true);
        res.writeHead(200, {
          "Content-Type": contentTypes[".html"],
          "Cache-Control": "no-cache"
        });
        res.end(fallbackData);
      });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const isHtml = extension === ".html";

    let cacheControl;
    if (extension === ".css" || extension === ".js") {
      cacheControl = "public, max-age=86400";
    } else if (
      extension === ".svg" ||
      extension === ".png" ||
      extension === ".jpg" ||
      extension === ".jpeg" ||
      extension === ".ico"
    ) {
      cacheControl = "public, max-age=604800";
    } else {
      cacheControl = "no-cache";
    }

    setSecurityHeaders(res, isHtml);
    res.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "Cache-Control": cacheControl
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || "/", `http://${HOST}`);

  if (req.method === "GET" && parsedUrl.pathname === "/health") {
    handleHealth(req, res);
    return;
  }

  if (req.method === "GET" && parsedUrl.pathname === "/api/admin/summary") {
    handleAdminSummary(req, res);
    return;
  }

  if (req.method === "GET" && parsedUrl.pathname === "/api/admin/consultant-applications/export.csv") {
    handleExportConsultantApplicationsCsv(req, res, parsedUrl);
    return;
  }

  if (req.method === "GET" && parsedUrl.pathname === "/api/admin/consultant-applications") {
    handleListConsultantApplications(req, res, parsedUrl);
    return;
  }

  const statusUpdateMatch = parsedUrl.pathname.match(
    /^\/api\/admin\/consultant-applications\/(\d+)\/status$/
  );

  if (req.method === "PATCH" && statusUpdateMatch) {
    handleUpdateConsultantApplicationStatus(req, res, statusUpdateMatch[1]);
    return;
  }

  if (req.method === "POST" && parsedUrl.pathname === "/api/inquiry") {
    handleInquiry(req, res);
    return;
  }

  if (req.method === "POST" && parsedUrl.pathname === "/api/consultant-application") {
    handleConsultantApplication(req, res);
    return;
  }

  if (req.method === "GET" && parsedUrl.pathname === "/api/admin/inquiries/export.csv") {
    handleExportInquiriesCsv(req, res, parsedUrl);
    return;
  }

  if (req.method === "GET" && parsedUrl.pathname === "/api/admin/inquiries") {
    handleListInquiries(req, res, parsedUrl);
    return;
  }

  const inquiryStatusMatch = parsedUrl.pathname.match(/^\/api\/admin\/inquiries\/(\d+)\/status$/);

  if (req.method === "PATCH" && inquiryStatusMatch) {
    handleUpdateInquiryStatus(req, res, inquiryStatusMatch[1]);
    return;
  }

  const inquiryNotesMatch = parsedUrl.pathname.match(/^\/api\/admin\/inquiries\/(\d+)\/notes$/);

  if (req.method === "PATCH" && inquiryNotesMatch) {
    handleUpdateInquiryNotes(req, res, inquiryNotesMatch[1]);
    return;
  }

  if (parsedUrl.pathname.startsWith("/api/")) {
    sendJson(res, 404, { ok: false, error: "Not found." });
    return;
  }

  if (req.method === "GET" && parsedUrl.pathname === "/admin") {
    req.url = "/admin/index.html";
  }

  if (req.method === "GET" && parsedUrl.pathname === "/admin/consultants") {
    req.url = "/admin/consultants.html";
  }

  if (req.method === "GET" && parsedUrl.pathname === "/admin/clients") {
    req.url = "/admin/clients.html";
  }

  serveStatic(req, res);
});

initializeDatabase()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Unexpected database initialization error.");
    console.error(error && error.message ? error.message : error);
    server.listen(PORT, HOST, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
