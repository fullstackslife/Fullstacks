const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const files = ["index.html", "styles.css", "favicon.svg"];
const assetDir = path.join(root, "assets");
const distAssetDir = path.join(dist, "assets");
const adminDir = path.join(root, "admin");
const distAdminDir = path.join(dist, "admin");
const consultantDir = path.join(root, "consultant");
const distConsultantDir = path.join(dist, "consultant");
const clientDir = path.join(root, "client");
const distClientDir = path.join(dist, "client");

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}

if (fs.existsSync(assetDir)) {
  fs.cpSync(assetDir, distAssetDir, { recursive: true });
}

if (fs.existsSync(adminDir)) {
  fs.cpSync(adminDir, distAdminDir, { recursive: true });
}

if (fs.existsSync(consultantDir)) {
  fs.cpSync(consultantDir, distConsultantDir, { recursive: true });
}

if (fs.existsSync(clientDir)) {
  fs.cpSync(clientDir, distClientDir, { recursive: true });
}

console.log(`Built ${files.length} files and assets into dist/`);
