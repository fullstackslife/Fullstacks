const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 10000,
  ssl: databaseUrl.includes("railway.internal") ? false : { rejectUnauthorized: false }
});

async function run() {
  const migrationsDir = path.join(__dirname, "..", "migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`Running migration ${file}`);
    await pool.query(sql);
  }

  console.log(`Ran ${migrationFiles.length} migration(s).`);
}

run()
  .catch((error) => {
    console.error("Migration failed.");
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
