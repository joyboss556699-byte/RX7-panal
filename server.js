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

for (const provider of [
  ["zenex", 0, 1],
  ["stex", 0, 2],
  ["voltx", 0, 3]
]) {
  db.prepare(`
    INSERT OR IGNORE INTO settings
    (provider, enabled, priority)
    VALUES (?, ?, ?)
  `).run(...provider);
}

function getActiveProviders() {
  return db.prepare(`
    SELECT provider, priority
    FROM settings
    WHERE enabled = 1
    ORDER BY priority ASC
  `).all();
}

/*
  Provider API adapter placeholder.
  এখানে আপনার authorized provider-এর official API
  documentation অনুযায়ী API integration বসাতে হবে।
*/
async function providerGetNumber(provider, service, country) {
  return {
    ok: false,
    provider,
    message: `${provider} API adapter is not configured yet.`
  };
}

/* Dashboard */
app.get("/api/dashboard", (req, res) => {
  const providers = db.prepare(`
    SELECT provider, enabled, priority
    FROM settings
    ORDER BY priority
  `).all();

  const orders = db.prepare(`
    SELECT *
    FROM orders
    ORDER BY id DESC
    LIMIT 20
  `).all();

  res.json({
    brand: "RX7 Panel",
    providers,
    orders
  });
});

/* Profile */
app.get("/api/profile", (req, res) => {
  const username = req.query.username || "demo";

  let user = db.prepare(`
    SELECT *
    FROM users
    WHERE username = ?
  `).get(username);

  if (!user) {
    db.prepare(`
      INSERT INTO users(username)
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

/* Console */
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

/* Get Number */
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

  const providers = getActiveProviders();

  if (!providers.length) {
    return res.status(409).json({
      error: "No provider is enabled by admin."
    });
  }

  for (const provider of providers) {
    const result = await providerGetNumber(
      provider.provider,
      service,
      country
    );

    if (result.ok) {
      const data = result.data || {};

      const saved = db.prepare(`
        INSERT INTO orders
        (username, provider, service, country, number, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        username,
        provider.provider,
        service,
        country,
        data.number || null,
        "active"
      );

      return res.json({
        ok: true,
        orderId: saved.lastInsertRowid,
        provider: provider.provider,
        data
      });
    }
  }

  res.status(503).json({
    error: "No enabled provider returned a number."
  });
});

/* Admin provider list */
app.get("/api/admin/providers", (req, res) => {
  const providers = db.prepare(`
    SELECT provider, enabled, priority
    FROM settings
    ORDER BY priority
  `).all();

  res.json(providers);
});

/* Admin provider ON/OFF */
app.post("/api/admin/providers/:provider", (req, res) => {
  const provider = req.params.provider.toLowerCase();

  if (!["zenex", "stex", "voltx"].includes(provider)) {
    return res.status(404).json({
      error: "Unknown provider."
    });
  }

  const {
    enabled,
    priority
  } = req.body || {};

  db.prepare(`
    UPDATE settings
    SET enabled = ?, priority = ?
    WHERE provider = ?
  `).run(
    enabled ? 1 : 0,
    Number.isFinite(Number(priority))
      ? Number(priority)
      : 99,
    provider
  );

  const updated = db.prepare(`
    SELECT provider, enabled, priority
    FROM settings
    WHERE provider = ?
  `).get(provider);

  res.json(updated);
});

/* Frontend */
app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RX7 Panel running on port ${PORT}`);
});
