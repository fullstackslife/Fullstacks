const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const files = ["index.html", "styles.css", "favicon.svg"];
const assetDir = path.join(root, "assets");
const distAssetDir = path.join(dist, "assets");

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}

if (fs.existsSync(assetDir)) {
  fs.cpSync(assetDir, distAssetDir, { recursive: true });
}

console.log(`Built ${files.length} files and assets into dist/`);
