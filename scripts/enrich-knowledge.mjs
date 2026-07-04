import Database from 'better-sqlite3';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, '..', process.env.DB_PATH || './data/app.db');
const db = new Database(dbPath);

// PPC document — longest message in DB
const body = db.prepare('SELECT body FROM messages ORDER BY length(body) DESC LIMIT 1').get().body;

// Find the curriculum matrix start
const matrixStart = body.search(/1[oº°]\s*Semestre\s*\nCH/i);
if (matrixStart === -1) throw new Error('Curriculum matrix not found in PPC');

// Extract the matrix section (ends at TOTAL GERAL)
const matrixEnd = body.indexOf('TOTAL GERAL', matrixStart) + 500;
const matrixText = body.slice(matrixStart, matrixEnd);

console.log(`Matrix section: chars ${matrixStart}–${matrixEnd} (${matrixText.length} chars)`);

// Parse the matrix
const lines = matrixText.split('\n').map(l => l.trim()).filter(Boolean);
const subjects = [];
let currentSemester = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Semester header: "1º Semestre", "2º Semestre", etc.
  const semMatch = line.match(/^(\d)[oº°]\s*Semestre$/i);
  if (semMatch) {
    currentSemester = parseInt(semMatch[1]);
    i++; // skip "CH" line
    continue;
  }

  // Skip totals and labels
  if (/^(CARGA HORÁRIA|TOTAL|CH|Atividade Curricular Extensionista|TOTAL CARGA|TOTAL ATIVIDADE|HORAS EXTRA|TOTAL GERAL)/i.test(line)) continue;

  // Page number lines (just digits like "42", "43")
  if (/^\d+$/.test(line) && parseInt(line) < 200) {
    // Could be a page number or a credit hour — check context
    // If previous line was a subject name, this is hours
    const prev = subjects[subjects.length - 1];
    if (prev && !prev.hours && currentSemester > 0) {
      prev.hours = parseInt(line);
    }
    continue;
  }

  // If next line is a number (hours), this line is a subject name
  const nextLine = lines[i + 1];
  if (nextLine && /^\d+$/.test(nextLine) && parseInt(nextLine) >= 30 && currentSemester > 0) {
    subjects.push({
      name: line,
      semester: currentSemester,
      hours: parseInt(nextLine),
    });
    i++; // consume the hours line
  }
}

// Extract course totals
const totalHoursMatch = matrixText.match(/TOTAL CARGA HORÁRIA:\s*\n(\d+)/);
const extensionMatch = matrixText.match(/TOTAL ATIVIDADE EXTENSIONISTA:\s*\n(\d+)/);
const extraMatch = matrixText.match(/HORAS EXTRA CURRICULARES:\s*\n(\d+)/);
const totalMatch = matrixText.match(/TOTAL GERAL:\s*\n(\d+)/);

const courseStructure = {
  total_semesters: subjects.length ? Math.max(...subjects.map(s => s.semester)) : 0,
  curriculum_hours: totalHoursMatch ? parseInt(totalHoursMatch[1]) : null,
  extension_hours: extensionMatch ? parseInt(extensionMatch[1]) : null,
  complementary_hours: extraMatch ? parseInt(extraMatch[1]) : null,
  total_hours: totalMatch ? parseInt(totalMatch[1]) : null,
};

const ppcData = {
  official_subjects: subjects,
  course_structure: courseStructure,
  evaluation_system: 'N1, N2, N3 por semestre. Prova integrada (N2) com questões de todas as disciplinas.',
};

console.log(`\nParsed ${subjects.length} subjects across ${currentSemester} semesters`);
subjects.forEach(s => console.log(`  Sem ${s.semester}: ${s.name} (${s.hours}h)`));
console.log('\nCourse structure:', courseStructure);

// Merge into knowledge-base.json
const kbPath = resolve(__dirname, '..', 'data', 'knowledge-base.json');
const kb = JSON.parse(readFileSync(kbPath, 'utf-8'));

kb.ppc = ppcData;

// Enrich existing subjects with official semester + hours where names overlap
for (const official of ppcData.official_subjects) {
  const existing = kb.subjects.find(s => {
    const a = s.name.toLowerCase().replace(/\s+/g, ' ').trim();
    const b = official.name.toLowerCase().replace(/\s+/g, ' ').trim();
    return a.includes(b.slice(0, 12)) || b.includes(a.slice(0, 12));
  });
  if (existing) {
    existing.official_name = official.name;
    existing.semester = official.semester;
    existing.hours = official.hours;
  }
}

writeFileSync(kbPath, JSON.stringify(kb, null, 2), 'utf-8');
console.log(`\nKnowledge base enriched: ${kbPath}`);
console.log(`Official subjects: ${ppcData.official_subjects.length}`);
