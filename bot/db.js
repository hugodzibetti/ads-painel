const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('./config');

let db = null;

function initializeDb() {
  if (db) return;

  const dbPath = config.db.path;
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath, { timeout: 5000 });

  const schemaPath = path.resolve(__dirname, '..', 'shared', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  console.log(`[DB] Initialized at ${dbPath}`);
}

function getDb() {
  if (!db) initializeDb();
  return db;
}

function insertMessage(waMessageId, groupLabel, author, body, timestamp) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed, created_at)
    VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
  `);

  try {
    stmt.run(waMessageId, groupLabel, author, body, timestamp);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      console.log(`[DB] Message ${waMessageId} already exists, skipping.`);
    } else {
      throw err;
    }
  }
}

module.exports = {
  getDb,
  initializeDb,
  insertMessage,
};
