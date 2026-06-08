const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
const publicDir = path.join(__dirname, "dist");
const dataDir = path.join(__dirname, "data");
const inquiryFile = path.join(dataDir, "inquiries.jsonl");
const maxBodySize = 32 * 1024;

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
  inquiryType: 120,
  urgency: 120,
  message: 4000
};

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

function validateInquiry(payload) {
  const inquiry = {
    name: cleanString(payload.name),
    email: cleanString(payload.email),
    phone: cleanString(payload.phone),
    company: cleanString(payload.company),
    inquiryType: cleanString(payload.inquiryType),
    urgency: cleanString(payload.urgency),
    message: cleanString(payload.message),
    website: cleanString(payload.website)
  };

  if (inquiry.website) {
    return { ok: true, spam: true, inquiry };
  }

  const requiredFields = ["name", "email", "inquiryType", "message"];
  const missing = requiredFields.filter((field) => !inquiry[field]);

  if (missing.length > 0) {
    return { ok: false, error: "Missing required fields." };
  }

  if (!isValidEmail(inquiry.email)) {
    return { ok: false, error: "Invalid email address." };
  }

  for (const [field, limit] of Object.entries(fieldLimits)) {
    if (inquiry[field].length > limit) {
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

  const record = {
    timestamp: new Date().toISOString(),
    name: validation.inquiry.name,
    email: validation.inquiry.email,
    phone: validation.inquiry.phone,
    company: validation.inquiry.company,
    inquiryType: validation.inquiry.inquiryType,
    urgency: validation.inquiry.urgency,
    message: validation.inquiry.message,
    source: "fullstacks.ink",
    userAgent: cleanString(req.headers["user-agent"]),
    ip: getClientIp(req)
  };

  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.appendFileSync(inquiryFile, `${JSON.stringify(record)}\n`, "utf8");
    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: "Unable to save inquiry." });
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

  if (parsedUrl.pathname.startsWith("/api/")) {
    sendJson(res, 404, { ok: false, error: "Not found." });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Server running on port ${PORT}`);
});
