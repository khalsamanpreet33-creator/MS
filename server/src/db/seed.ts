import bcrypt from 'bcryptjs';
import { db } from './client.js';
import { ensureDirs } from '../config.js';
import { runMigrations } from './migrate.js';
import { id, publicNo } from '../lib/ids.js';

function randomString(prefix: string, n: number): string {
  return prefix + '-' + String(n).padStart(4, '0');
}

const FIRST_NAMES = [
  'Aarav', 'Aanya', 'Aditi', 'Arjun', 'Diya', 'Ishaan', 'Kavya', 'Maya',
  'Neel', 'Priya', 'Rahul', 'Riya', 'Rohan', 'Saanvi', 'Siddharth', 'Tanvi',
  'Vivaan', 'Zara', 'Aryan', 'Anaya',
];
const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Kumar', 'Singh', 'Iyer', 'Reddy', 'Nair',
  'Joshi', 'Mehta', 'Gupta', 'Khan', 'Das', 'Bose',
];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }

export function seed(): void {
  const conn = db();
  const today = new Date().toISOString().slice(0, 10);

  // Demo users
  const adminId = id('usr');
  const receptionId = id('usr');
  const teacherId = id('usr');
  const accountantId = id('usr');
  const hash = (p: string) => bcrypt.hashSync(p, 10);

  const insertUser = conn.prepare(
    `INSERT INTO users (id, username, full_name, email, phone, password_hash, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
  );
  const insertUserRole = conn.prepare(
    `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`,
  );

  const seedUsers = conn.transaction(() => {
    insertUser.run(adminId, 'admin', 'System Admin', 'admin@school.local', '+91 90000 00001', hash('admin'));
    insertUserRole.run(adminId, 'r_admin');

    insertUser.run(receptionId, 'reception', 'Reception Desk', 'reception@school.local', '+91 90000 00002', hash('reception'));
    insertUserRole.run(receptionId, 'r_reception');

    insertUser.run(teacherId, 'teacher1', 'Anita Verma', 'anita@school.local', '+91 90000 00003', hash('teacher'));
    insertUserRole.run(teacherId, 'r_teacher');

    insertUser.run(accountantId, 'accountant', 'Suresh Iyer', 'suresh@school.local', '+91 90000 00004', hash('accountant'));
    insertUserRole.run(accountantId, 'r_accountant');
  });
  seedUsers();

  // Classes
  const classes = [
    { id: id('cls'), name: 'Grade 1', grade: 1, teacher: teacherId },
    { id: id('cls'), name: 'Grade 2', grade: 2, teacher: teacherId },
    { id: id('cls'), name: 'Grade 3', grade: 3, teacher: teacherId },
  ];
  const insertClass = conn.prepare(
    `INSERT INTO classes (id, name, grade_level, academic_year, class_teacher_id)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const seedClasses = conn.transaction(() => {
    for (const c of classes) {
      insertClass.run(c.id, c.name, c.grade, '2025-2026', c.teacher);
    }
  });
  seedClasses();

  // Sections
  const sections: { id: string; class_id: string; name: string }[] = [];
  const sectionNames = ['A', 'B'];
  for (const c of classes) {
    for (const n of sectionNames) {
      sections.push({ id: id('sec'), class_id: c.id, name: n });
    }
  }
  const insertSection = conn.prepare(
    `INSERT INTO sections (id, class_id, name, capacity, class_teacher_id)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const seedSections = conn.transaction(() => {
    for (const s of sections) {
      insertSection.run(s.id, s.class_id, s.name, 40, teacherId);
    }
  });
  seedSections();

  // Students
  const studentIds: string[] = [];
  const insertStudent = conn.prepare(
    `INSERT INTO students
      (id, admission_no, first_name, last_name, date_of_birth, gender, address,
       guardian_name, guardian_relation, guardian_phone, guardian_email, joining_date,
       current_class_id, current_section_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const seedStudents = conn.transaction(() => {
    for (let i = 0; i < 25; i++) {
      const cls = classes[i % classes.length];
      const sec = sections.find((s) => s.class_id === cls.id && s.name === (i % 2 === 0 ? 'A' : 'B'))!;
      const studentId = id('stu');
      studentIds.push(studentId);
      const firstName = pick(FIRST_NAMES, i);
      const lastName = pick(LAST_NAMES, i * 3);
      const gender = i % 2 === 0 ? 'male' : 'female';
      insertStudent.run(
        studentId,
        randomString('ADM', 1000 + i),
        firstName,
        lastName,
        '2018-0' + ((i % 9) + 1) + '-15',
        gender,
        'House ' + (i + 1) + ', City',
        `${firstName}'s Guardian`,
        gender === 'male' ? 'Father' : 'Mother',
        '+91 9' + String(100000000 + i * 137).slice(0, 9),
        `parent${i}@example.com`,
        today,
        cls.id,
        sec.id,
      );
    }
  });
  seedStudents();

  // Fee structures (one per class)
  const structureIds: string[] = [];
  const insertStructure = conn.prepare(
    `INSERT INTO fee_structures (id, class_id, name, amount, frequency, due_day_of_month)
     VALUES (?, ?, ?, ?, 'monthly', 10)`,
  );
  const seedStructures = conn.transaction(() => {
    for (const c of classes) {
      const sid = id('fst');
      structureIds.push(sid);
      const amount = 2000 + c.grade * 500;
      insertStructure.run(sid, c.id, 'Tuition Fee', amount);
    }
  });
  seedStructures();

  // Invoices for current month
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const periodStart = `${month}-01`;
  const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const periodEnd = `${month}-${String(lastDay).padStart(2, '0')}`;
  const dueDate = `${month}-10`;

  const insertInvoice = conn.prepare(
    `INSERT INTO fee_invoices
      (id, invoice_no, student_id, structure_id, period_label, period_start,
       period_end, amount, total, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const seedInvoices = conn.transaction(() => {
    for (let i = 0; i < studentIds.length; i++) {
      const sid = studentIds[i];
      const structId = structureIds[i % classes.length];
      const cls = classes[i % classes.length];
      const amount = 2000 + cls.grade * 500;
      // Mark every 3rd as already partially paid
      const isPartial = i % 3 === 0;
      const isPaid = i % 5 === 0;
      if (isPaid) {
        insertInvoice.run(id('inv'), publicNo('INV'), sid, structId, month, periodStart, periodEnd, amount, amount, dueDate);
        const invId = conn.prepare('SELECT id FROM fee_invoices WHERE invoice_no = ?').get(publicNo('INV') /* placeholder */) as { id: string } | undefined;
        // We won't depend on the lookup — use a simpler approach:
        conn.prepare('UPDATE fee_invoices SET paid = amount, balance = 0, status = \'paid\' WHERE student_id = ? AND period_label = ?')
          .run(sid, month);
      } else if (isPartial) {
        insertInvoice.run(id('inv'), publicNo('INV'), sid, structId, month, periodStart, periodEnd, amount, amount, dueDate);
        conn.prepare('UPDATE fee_invoices SET paid = ?, balance = ?, status = \'partial\' WHERE student_id = ? AND period_label = ?')
          .run(amount / 2, amount / 2, sid, month);
      } else {
        insertInvoice.run(id('inv'), publicNo('INV'), sid, structId, month, periodStart, periodEnd, amount, amount, dueDate);
      }
    }
  });
  seedInvoices();

  console.log('[seed] complete:');
  console.log(`  users:     4 (admin/admin, reception/reception, teacher1/teacher, accountant/accountant)`);
  console.log(`  classes:   ${classes.length}`);
  console.log(`  sections:  ${sections.length}`);
  console.log(`  students:  ${studentIds.length}`);
  console.log(`  structures:${structureIds.length}`);
  console.log(`  invoices:  ${studentIds.length} for ${month}`);
}

const isDirect =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('seed.ts');

if (isDirect) {
  ensureDirs();
  runMigrations();
  seed();
  process.exit(0);
}