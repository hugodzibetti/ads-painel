const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const os = require('os');

let originalEnv;

function createTestDb() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const dbPath = path.join(tempDir, 'test.db');
  return { dbPath, tempDir };
}

function initTestSchema(dbPath) {
  const schemaPath = path.resolve(__dirname, '..', '..', 'shared', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  const db = new Database(dbPath);
  db.exec(schema);
  db.close();
}

function testInsertMessage() {
  const { dbPath, tempDir } = createTestDb();
  initTestSchema(dbPath);

  const db = new Database(dbPath);

  const stmt = db.prepare(`
    INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed, created_at)
    VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
  `);

  stmt.run('msg1', 'alunos', 'João', 'Test message', new Date().toISOString());

  const row = db.prepare('SELECT * FROM messages WHERE wa_message_id = ?').get('msg1');
  console.assert(row !== undefined, 'Message should be inserted');
  console.assert(row.author === 'João', 'Author should be João');
  console.assert(row.processed === 0, 'Message should not be processed');

  db.close();
  fs.rmSync(tempDir, { recursive: true });
}

function testInsertDuplicateMessage() {
  const { dbPath, tempDir } = createTestDb();
  initTestSchema(dbPath);

  const db = new Database(dbPath);

  const stmt = db.prepare(`
    INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed, created_at)
    VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
  `);

  stmt.run('msg1', 'alunos', 'João', 'Test', new Date().toISOString());

  try {
    stmt.run('msg1', 'alunos', 'Maria', 'Another test', new Date().toISOString());
    console.assert(false, 'Should have thrown UNIQUE constraint error');
  } catch (err) {
    console.assert(err.message.includes('UNIQUE'), 'Should throw UNIQUE constraint error');
  }

  db.close();
  fs.rmSync(tempDir, { recursive: true });
}

function testMessageWithoutBody() {
  const { dbPath, tempDir } = createTestDb();
  initTestSchema(dbPath);

  const db = new Database(dbPath);

  const stmt = db.prepare(`
    INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed, created_at)
    VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
  `);

  stmt.run('msg1', 'profs', 'Prof Silva', null, new Date().toISOString());

  const row = db.prepare('SELECT * FROM messages WHERE wa_message_id = ?').get('msg1');
  console.assert(row !== undefined, 'Message should be inserted');
  console.assert(row.body === null, 'Body can be null');

  db.close();
  fs.rmSync(tempDir, { recursive: true });
}

function testMultipleGroupLabels() {
  const { dbPath, tempDir } = createTestDb();
  initTestSchema(dbPath);

  const db = new Database(dbPath);

  const stmt = db.prepare(`
    INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed, created_at)
    VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
  `);

  stmt.run('msg1', 'alunos', 'João', 'Test1', new Date().toISOString());
  stmt.run('msg2', 'profs', 'Prof Silva', 'Test2', new Date().toISOString());

  const alunosCount = db.prepare('SELECT COUNT(*) as count FROM messages WHERE group_label = ?').get('alunos').count;
  const profsCount = db.prepare('SELECT COUNT(*) as count FROM messages WHERE group_label = ?').get('profs').count;

  console.assert(alunosCount === 1, 'Should have 1 alunos message');
  console.assert(profsCount === 1, 'Should have 1 profs message');

  db.close();
  fs.rmSync(tempDir, { recursive: true });
}

if (require.main === module) {
  try {
    testInsertMessage();
    console.log('✓ testInsertMessage');

    testInsertDuplicateMessage();
    console.log('✓ testInsertDuplicateMessage');

    testMessageWithoutBody();
    console.log('✓ testMessageWithoutBody');

    testMultipleGroupLabels();
    console.log('✓ testMultipleGroupLabels');

    console.log('\nAll tests passed!');
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
}

module.exports = {
  testInsertMessage,
  testInsertDuplicateMessage,
  testMessageWithoutBody,
  testMultipleGroupLabels,
};
