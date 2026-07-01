const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const VALID_GROUP_LABELS = ['alunos', 'profs'];

let db = null;

function readSchema(schemaPath) {
  try {
    return fs.readFileSync(schemaPath, 'utf-8');
  } catch (err) {
    throw new Error(
      `Falha ao ler schema SQL em ${schemaPath}. Verifique se shared/schema.sql existe e o processo tem permissão de leitura. (${err.message})`
    );
  }
}

function initializeDb(schemaPath = path.resolve(__dirname, '..', 'shared', 'schema.sql')) {
  if (db) return;

  const dbPath = config.db.path;
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath, { timeout: 5000 });

  const schema = readSchema(schemaPath);
  db.exec(schema);

  console.log(`[DB] Initialized at ${dbPath}`);
}

function getDb() {
  if (!db) initializeDb();
  return db;
}

function insertMessage(waMessageId, groupLabel, author, body, timestamp) {
  if (!VALID_GROUP_LABELS.includes(groupLabel)) {
    throw new Error(`groupLabel inválido: '${groupLabel}'. Esperado 'alunos' ou 'profs'.`);
  }

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
  readSchema,
};
