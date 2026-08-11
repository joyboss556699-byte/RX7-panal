import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// SQLite database
const db = new Database("rx7.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    provider TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 99
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    provider TEXT NOT NULL,
    service TEXT NOT NULL,
    country TEXT NOT NULL,
    number TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// Default providers
const providers = [
  ["zenex", 0, 1],
  ["stex", 0, 2],
  ["voltx", 0, 3]
];

for (const provider of providers) {
  db.prepare(`
    INSERT OR IGNORE INTO settings
    (provider, enabled, priority)
    VALUES (?, ?, ?)
  `).run(...provider);
}

// Active providers
function getActiveProviders() {
  return db.prepare(`
    SELECT provider, priority
    FROM settings
    WHERE enabled = 1
    ORDER BY priority ASC
  `).all();
}

// ==============================
// DASHBOARD
// ==============================

app.get("/api/dashboard", (req, res) => {
  const providerList = db.prepare(`
    SELECT provider, enabled, priority
    FROM settings
    ORDER BY priority ASC
  `).all();

  const orders = db.prepare(`
    SELECT *
    FROM orders
    ORDER BY id DESC
    LIMIT 20
  `).all();

  res.json({
    brand: "RX7 Panel",
    providers: providerList,
    orders
  });
});

// ==============================
// PROFILE
// ==============================

app.get("/api/profile", (req, res) => {
  const username = req.query.username || "demo";

  let user = db.prepare(`
    SELECT *
    FROM users
    WHERE username = ?
  `).get(username);

  if (!user) {
    db.prepare(`
      INSERT INTO users (username)
      VALUES (?)
    `).run(username);

    user = db.prepare(`
      SELECT *
      FROM users
      WHERE username = ?
    `).get(username);
  }

  res.json(user);
});

// ==============================
// CONSOLE
// ==============================

app.get("/api/console", (req, res) => {
  const orders = db.prepare(`
    SELECT
      id,
      provider,
      service,
      country,
      number,
      status,
      created_at
    FROM orders
    ORDER BY id DESC
    LIMIT 100
  `).all();

  res.json(orders);
});

// ==============================
// GET NUMBER
// ==============================

app.post("/api/get-number", async (req, res) => {
  const {
    username = "demo",
    service,
    country
  } = req.body || {};

  if (!service || !country) {
    return res.status(400).json({
      error: "Service and country are required."
    });
  }

  const activeProviders = getActiveProviders();

  if (activeProviders.length === 0) {
    return res.status(409).json({
      error: "No provider is enabled by admin."
    });
  }

  /*
    Provider API integration intentionally left as an adapter.

    Connect only APIs you are authorized to use and follow
    their official documentation, authentication and usage rules.
  */

  return res.status(501).json({
    error: "Provider API is not configured yet.",
    enabledProviders: activeProviders.map(
      item => item.provider
    )
  });
});

// ==============================
// ADMIN - PROVIDERS
// ==============================

app.get("/api/admin/providers", (req, res) => {
  const providerList = db.prepare(`
    SELECT provider, enabled, priority
    FROM settings
    ORDER BY priority ASC
  `).all();

  res.json(providerList);
});

// ==============================
// ADMIN - PROVIDER ON/OFF
// ==============================

app.post("/api/admin/providers/:provider", (req, res) => {
  const provider = String(
    req.params.provider
  ).toLowerCase();

  if (!["zenex", "stex", "voltx"].includes(provider)) {
    return res.status(404).json({
      error: "Unknown provider."
    });
  }

  const enabled =
    req.body?.enabled ? 1 : 0;

  const priority =
    Number.isFinite(Number(req.body?.priority))
      ? Number(req.body.priority)
      : 99;

  db.prepare(`
    UPDATE settings
    SET enabled = ?, priority = ?
    WHERE provider = ?
  `).run(
    enabled,
    priority,
    provider
  );

  const updated = db.prepare(`
    SELECT provider, enabled, priority
    FROM settings
    WHERE provider = ?
  `).get(provider);

  res.json(updated);
});

// ==============================
// FRONTEND FALLBACK
// Express 5 compatible
// ==============================

app.use((req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

// ==============================
// START SERVER
// ==============================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `RX7 Panel running on port ${PORT}`
    );
  }
);
