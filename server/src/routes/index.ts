import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import authRoutes from './auth.routes.js';
import studentsRoutes from './students.routes.js';
import classesRoutes from './classes.routes.js';
import attendanceRoutes from './attendance.routes.js';
import feesRoutes from './fees.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import healthRoutes from './health.routes.js';
import backupsRoutes from './backups.routes.js';
import settingsRoutes from './settings.routes.js';
import rolesRoutes from './roles.routes.js';
import auditRoutes from './audit.routes.js';
import subjectsRoutes from './subjects.routes.js';
import syllabusRoutes from './syllabus.routes.js';
import questionBankRoutes from './questionBank.routes.js';
import questionPapersRoutes from './questionPapers.routes.js';
import staffRoutes from './staff.routes.js';
import teachersRoutes from './teachers.routes.js';
import hrRoutes from './hr.routes.js';
import payrollRoutes from './payroll.routes.js';
import examsRoutes from './exams.routes.js';
import admissionsRoutes from './admissions.routes.js';
import parentsRoutes from './parents.routes.js';
import homeworkRoutes from './homework.routes.js';
import timetableRoutes from './timetable.routes.js';
import accountsRoutes from './accounts.routes.js';
import tasksRoutes from './tasks.routes.js';
import documentsRoutes from './documents.routes.js';
import eventsRoutes from './events.routes.js';
import complaintsRoutes from './complaints.routes.js';
import idcardsRoutes from './idcards.routes.js';
import certificatesRoutes from './certificates.routes.js';
import noticesRoutes from './notices.routes.js';
import emergencyRoutes from './emergency.routes.js';
import notificationsRoutes from './notifications.routes.js';
import bulkCommRoutes from './bulkComm.routes.js';
import vehiclesRoutes from './vehicles.routes.js';
import driversRoutes from './drivers.routes.js';
import transportRoutes from './transport.routes.js';
import libraryRoutes from './library.routes.js';
import inventoryRoutes from './inventory.routes.js';
import assetsRoutes from './assets.routes.js';
import reportsRoutes from './reports.routes.js';
import { audit } from '../middleware/audit.js';
import { stubRouter } from './_stub.routes.js';

const router = Router();

// Global audit logger. Registered first so it captures every state-changing
// request; `res.on('finish')` runs after the route's own `requireAuth` has
// populated `req.user`, so actor_id is filled for protected routes and null
// for /auth/login (the only public state-changing endpoint).
router.use(audit);

router.get('/health/db', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/students', studentsRoutes);
router.use('/classes', classesRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/fees', feesRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/health', healthRoutes);
router.use('/backups', backupsRoutes);
router.use('/settings', settingsRoutes);
router.use('/roles', rolesRoutes);
router.use('/audit', auditRoutes);
router.use('/subjects', subjectsRoutes);
router.use('/syllabus', syllabusRoutes);
router.use('/question-bank', questionBankRoutes);
router.use('/question-papers', questionPapersRoutes);
router.use('/staff', staffRoutes);
router.use('/teachers', teachersRoutes);
router.use('/hr', hrRoutes);
router.use('/payroll', payrollRoutes);
router.use('/exams', examsRoutes);
router.use('/admissions', admissionsRoutes);
router.use('/parents', parentsRoutes);
router.use('/homework', homeworkRoutes);
router.use('/timetable', timetableRoutes);
router.use('/accounts', accountsRoutes);
router.use('/tasks', tasksRoutes);
router.use('/documents', documentsRoutes);
router.use('/events', eventsRoutes);
router.use('/complaints', complaintsRoutes);
router.use('/idcards', idcardsRoutes);
router.use('/certificates', certificatesRoutes);
router.use('/notices', noticesRoutes);
router.use('/emergency', emergencyRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/bulk-comm', bulkCommRoutes);
router.use('/vehicles', vehiclesRoutes);
router.use('/drivers', driversRoutes);
router.use('/transport', transportRoutes);
router.use('/library', libraryRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/assets', assetsRoutes);
router.use('/reports', reportsRoutes);

// ---------------------------------------------------------------------------
// Phase 2+ module stubs — all wired so the SPA can navigate.
// ---------------------------------------------------------------------------
const stubs = [
  ['admissions', '/admissions'], // overridden by admissionsRoutes above
  ['parents', '/parents'], // overridden by parentsRoutes above
  ['teachers', '/teachers'], // overridden by teachersRoutes above
  ['timetable', '/timetable'],
  ['homework', '/homework'], // overridden by homeworkRoutes above
  ['timetable', '/timetable'], // overridden by timetableRoutes above
  ['exams', '/exams'], // overridden by examsRoutes above
  ['results', '/results'],
  ['accounts', '/accounts'], // overridden by accountsRoutes above
  ['payroll', '/payroll'], // overridden by payrollRoutes above
  ['hr', '/hr'], // overridden by hrRoutes above
  ['transport', '/transport'], // overridden by transportRoutes above
  ['vehicles', '/vehicles'], // overridden by vehiclesRoutes above
  ['drivers', '/drivers'], // overridden by driversRoutes above
  ['transport-routes', '/transport-routes'],
  ['library', '/library'], // overridden by libraryRoutes above
  ['inventory', '/inventory'], // overridden by inventoryRoutes above
  ['assets', '/assets'], // overridden by assetsRoutes above
  ['documents', '/documents'], // overridden by documentsRoutes above
  ['events', '/events'], // overridden by eventsRoutes above
  ['complaints', '/complaints'], // overridden by complaintsRoutes above
  ['reports', '/reports'], // overridden by reportsRoutes above
  ['idcards', '/idcards'], // overridden by idcardsRoutes above
  ['certificates', '/certificates'], // overridden by certificatesRoutes above
  ['notifications', '/notifications'],
  ['system-health', '/system-health'],
  ['tasks', '/tasks'], // overridden by tasksRoutes above
  ['approvals', '/approvals'],
  ['calendar', '/calendar'],
  ['notice-board', '/notice-board'], // overridden by noticesRoutes above
  ['emergency', '/emergency'], // overridden by emergencyRoutes above
  ['bulk-comm', '/bulk-comm'], // overridden by bulkCommRoutes above
] as const;

for (const [name, mount] of stubs) {
  router.use(mount, requireAuth, stubRouter(name));
}

export default router;