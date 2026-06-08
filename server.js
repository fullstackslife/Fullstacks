const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
const publicDir = path.join(__dirname, "dist");
const maxBodySize = 64 * 1024;
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("railway.internal") ? false : { rejectUnauthorized: false }
    })
  : null;

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

function sendJson(res, statusCode, payload) {
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

async function initializeDatabase() {
  if (!pool) {
    return;
  }

  await pool.query(`
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
  `);

  await pool.query(`
    ALTER TABLE inquiries
      ADD COLUMN IF NOT EXISTS property_name TEXT,
      ADD COLUMN IF NOT EXISTS property_location TEXT,
      ADD COLUMN IF NOT EXISTS brand_flag TEXT,
      ADD COLUMN IF NOT EXISTS room_count TEXT,
      ADD COLUMN IF NOT EXISTS property_relationship TEXT,
      ADD COLUMN IF NOT EXISTS current_challenge TEXT
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS consultant_applications (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      current_role TEXT NOT NULL,
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
  `);
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

  if (!pool) {
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

  if (!pool) {
    sendJson(res, 503, { ok: false, error: "Consultant application storage is not configured." });
    return;
  }

  const application = validation.application;

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
          current_role,
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
    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: "Unable to save consultant application." });
  }
}

function resolveRequestPath(url) {
  const parsedUrl = new URL(url, `http://${HOST}`);
  const safePath = path.normalize(decodeURIComponent(parsedUrl.pathname)).replace(/^(\.\.[/\\])+/, "");
  const requestedPath = safePath === "/" ? "/index.html" : safePath;
  return path.join(publicDir, requestedPath);
}

function serveStatic(req, res) {
  if (!fs.existsSync(publicDir)) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Build output not found. Run npm run build before npm run start.");
    return;
  }

  const filePath = resolveRequestPath(req.url || "/");

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(publicDir, "index.html"), (fallbackError, fallbackData) => {
        if (fallbackError) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Not found");
          return;
        }

        res.writeHead(200, { "Content-Type": contentTypes[".html"] });
        res.end(fallbackData);
      });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": contentTypes[extension] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || "/", `http://${HOST}`);

  if (req.method === "POST" && parsedUrl.pathname === "/api/inquiry") {
    handleInquiry(req, res);
    return;
  }

  if (req.method === "POST" && parsedUrl.pathname === "/api/consultant-application") {
    handleConsultantApplication(req, res);
    return;
  }

  if (parsedUrl.pathname.startsWith("/api/")) {
    sendJson(res, 404, { ok: false, error: "Not found." });
    return;
  }

  serveStatic(req, res);
});

initializeDatabase()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(() => {
    console.error("Inquiry database initialization failed.");
    process.exit(1);
  });
