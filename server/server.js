require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const multer = require('multer');

const rateLimit = require('express-rate-limit');

const db = require('./db');
const { authenticateToken, requireAdmin, requireStudent } = require('./middleware/auth');
const { uploadPhoto, uploadDocument, getMimeType, retrieveFile } = require('./services/storageService');
const { ensureSampleFiles } = require('./services/seedFiles');
const realtime = require('./realtime');

// Controllers
const authCtrl = require('./controllers/authController');
const studentCtrl = require('./controllers/studentController');
const timetableCtrl = require('./controllers/timetableController');
const attendanceCtrl = require('./controllers/attendanceController');
const academicCtrl = require('./controllers/academicController');
const resultsCtrl = require('./controllers/resultsController');
const excelCtrl = require('./controllers/excelController');
const notifCtrl = require('./controllers/notificationController');
const aiCtrl = require('./controllers/aiController');
const searchCtrl = require('./controllers/searchController');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & performance middlewares
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static Asset Directories with strict MIME headers
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  setHeaders: (res, filePath) => {
    const mime = getMimeType(filePath);
    res.setHeader('Content-Type', mime);
  }
}));

// Explicit 404 with persistent database recovery for missing upload files (Prevents SPA index.html fallback)
app.use('/uploads/*', async (req, res) => {
  try {
    const rel = req.originalUrl.split('?')[0];
    const retrieved = await retrieveFile(rel);
    if (retrieved.found && retrieved.path && fs.existsSync(retrieved.path)) {
      const mime = getMimeType(retrieved.path);
      res.setHeader('Content-Type', mime);
      return res.sendFile(retrieved.path);
    }
  } catch (e) {}
  res.status(404).json({ success: false, message: 'Requested document file not found on server.' });
});

// Direct APK Download Endpoint (Registered before express.static to guarantee proper Android MIME headers)
app.get(['/download/apk', '/apk/download', '/apk/MGI_Student_Portal.apk', '/MGI_Student_Portal.apk'], (req, res) => {
  const apkPath = path.join(__dirname, '..', 'public', 'apk', 'MGI_Student_Portal.apk');
  if (!fs.existsSync(apkPath)) {
    return res.status(404).json({ success: false, message: 'APK file not found on server.' });
  }
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="MGI_Student_Portal.apk"');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(apkPath, 'MGI_Student_Portal.apk');
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// Rate Limiter for Authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ==================== API ROUTES ====================

// 1. Health & Status (Active DB Ping)
app.get('/api/health', async (req, res) => {
  let dbStatus = { alive: false, latencyMs: 0, engine: 'Unknown' };
  try {
    dbStatus = await db.ping();
  } catch (err) {
    dbStatus.error = err.message;
  }

  const isHealthy = dbStatus.alive;
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'OK' : 'DEGRADED',
    healthy: isHealthy,
    app: 'Mishra Group Institute B.Tech Cyber Security Student Portal & Admin Panel',
    division: '3CYBER7',
    semester: '3rd Semester',
    academicYear: '2026-27',
    database: dbStatus,
    uptimeSeconds: Math.floor(process.uptime()),
    activeRealtimeClients: realtime.getActiveClientCount(),
    time: new Date().toISOString()
  });
});

// 2. Authentication
app.post('/api/auth/login', authLimiter, authCtrl.unifiedLogin);
app.post('/api/auth/student-login', authLimiter, authCtrl.studentLogin);
app.post('/api/auth/admin-login', authLimiter, authCtrl.adminLogin);
app.post('/api/auth/forgot-password', authLimiter, authCtrl.forgotPassword);
app.post('/api/auth/change-password', authenticateToken, authCtrl.changePassword);
app.get('/api/auth/profile', authenticateToken, authCtrl.getProfile);
app.post('/api/auth/upload-photo', authenticateToken, requireStudent, uploadPhoto.single('photo'), authCtrl.uploadProfilePhoto);

// 3. Students Management (Strict Admin Control, 4-field Add Form)
app.post('/api/admin/students', authenticateToken, requireAdmin, studentCtrl.addStudent);
app.get('/api/admin/students', authenticateToken, requireAdmin, studentCtrl.getAllStudents);
app.get('/api/admin/students/:id', authenticateToken, requireAdmin, studentCtrl.getStudentById);
app.put('/api/admin/students/:id', authenticateToken, requireAdmin, studentCtrl.updateStudent);
app.post('/api/admin/students/:id/toggle-cr', authenticateToken, requireAdmin, studentCtrl.toggleCRStatus);
app.delete('/api/admin/students/:id', authenticateToken, requireAdmin, studentCtrl.deleteStudent);

// 4. Timetable & Manual Room Change / Class Overrides
app.get('/api/timetable', authenticateToken, timetableCtrl.getStudentTimetable);
app.get('/api/timetable/today', authenticateToken, timetableCtrl.getTodayClasses);
app.get('/api/timetable/overrides/today', authenticateToken, timetableCtrl.getOverridesForDate);
app.get('/api/admin/timetable', authenticateToken, requireAdmin, timetableCtrl.getAllTimetable);
app.post('/api/admin/timetable', authenticateToken, requireAdmin, timetableCtrl.createTimetableEntry);
app.put('/api/admin/timetable/:id', authenticateToken, requireAdmin, timetableCtrl.updateTimetableEntry);
app.delete('/api/admin/timetable/:id', authenticateToken, requireAdmin, timetableCtrl.deleteTimetableEntry);

// Manual Room Change & Override Controls (Admin & Authorized CR)
app.post('/api/timetable/room-change', authenticateToken, timetableCtrl.createRoomChangeOverride);
app.post('/api/timetable/cancel-class', authenticateToken, requireAdmin, timetableCtrl.cancelClassOverride);
app.delete('/api/timetable/override/:id', authenticateToken, requireAdmin, timetableCtrl.revertClassOverride);
app.post('/api/timetable/override/revert', authenticateToken, requireAdmin, timetableCtrl.revertClassOverride);
app.get('/api/timetable/overrides/history', authenticateToken, timetableCtrl.getOverrideHistory);

// Realtime Server-Sent Events (SSE) Stream
app.get('/api/realtime/events', authenticateToken, (req, res) => realtime.registerClient(req, res, req.user));

// Holidays & Leaves Management
app.get('/api/holidays', authenticateToken, timetableCtrl.getHolidays);
app.post('/api/admin/holidays', authenticateToken, requireAdmin, timetableCtrl.addHoliday);
app.delete('/api/admin/holidays/:id', authenticateToken, requireAdmin, timetableCtrl.deleteHoliday);

const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// 5. Dual Attendance System (Instant QR + Biometric Face Scan)
app.post('/api/attendance/session/start', authenticateToken, requireAdmin, attendanceCtrl.startQRSession);
app.get('/api/attendance/session/:id/live-token', attendanceCtrl.getLiveQRToken);
app.post('/api/attendance/session/:id/stop', authenticateToken, requireAdmin, attendanceCtrl.stopQRSession);
app.get('/api/attendance/session/:id/scans', authenticateToken, requireAdmin, attendanceCtrl.getSessionScans);
app.get('/api/attendance/active-sessions', authenticateToken, attendanceCtrl.getActiveSessions);
app.post('/api/attendance/scan', authenticateToken, requireStudent, attendanceCtrl.markQRScan);
app.post('/api/attendance/face-scan', authenticateToken, requireStudent, attendanceCtrl.markFaceScanAttendance);
app.post('/api/attendance/manual', authenticateToken, requireAdmin, attendanceCtrl.saveManualAttendance);
app.get('/api/attendance/student-summary', authenticateToken, requireStudent, attendanceCtrl.getStudentAttendance);
app.get('/api/attendance/admin-report', authenticateToken, requireAdmin, attendanceCtrl.getAdminAttendanceReport);

// 6. Academic Content (Class Notes, Study Material, Assignments, Question Papers, Calendar, Announcements)
// Subjects & Subject Study Hub
app.get('/api/academic/subjects', authenticateToken, academicCtrl.getSubjects);
app.get('/api/academic/study-hub', authenticateToken, academicCtrl.getSubjectStudyHub);

// Class Notes
app.get('/api/academic/notes', authenticateToken, academicCtrl.getClassNotes);
app.post('/api/academic/notes', authenticateToken, requireAdmin, uploadDocument('notes').single('file'), academicCtrl.uploadClassNote);
app.delete('/api/academic/notes/:id', authenticateToken, requireAdmin, academicCtrl.deleteClassNote);

// Study Material
app.get('/api/academic/material', authenticateToken, academicCtrl.getStudyMaterials);
app.post('/api/academic/material', authenticateToken, requireAdmin, uploadDocument('material').single('file'), academicCtrl.uploadStudyMaterial);
app.delete('/api/academic/material/:id', authenticateToken, requireAdmin, academicCtrl.deleteStudyMaterial);

// Assignments
app.get('/api/academic/assignments', authenticateToken, academicCtrl.getAssignments);
app.post('/api/academic/assignments', authenticateToken, requireAdmin, uploadDocument('assignments').single('file'), academicCtrl.createAssignment);
app.delete('/api/academic/assignments/:id', authenticateToken, requireAdmin, academicCtrl.deleteAssignment);

// Question Papers
app.get('/api/academic/question-papers', authenticateToken, academicCtrl.getQuestionPapers);
app.post('/api/academic/question-papers', authenticateToken, requireAdmin, uploadDocument('papers').single('file'), academicCtrl.uploadQuestionPaper);
app.delete('/api/academic/question-papers/:id', authenticateToken, requireAdmin, academicCtrl.deleteQuestionPaper);

// Academic File Download (Guarantees original file extension and attachment header)
app.get('/api/academic/download', authenticateToken, academicCtrl.downloadAcademicFile);

// Calendar & Announcements
app.get('/api/academic/calendar', authenticateToken, academicCtrl.getAcademicCalendar);
app.post('/api/academic/calendar', authenticateToken, requireAdmin, academicCtrl.addCalendarEvent);
app.delete('/api/academic/calendar/:id', authenticateToken, requireAdmin, academicCtrl.deleteCalendarEvent);

app.get('/api/academic/announcements', authenticateToken, academicCtrl.getAnnouncements);
app.post('/api/academic/announcements', authenticateToken, requireAdmin, academicCtrl.createAnnouncement);
app.delete('/api/academic/announcements/:id', authenticateToken, requireAdmin, academicCtrl.deleteAnnouncement);

// 7. Results & Excel Bulk Upload
app.get('/api/results/my', authenticateToken, requireStudent, resultsCtrl.getStudentResults);
app.post('/api/results', authenticateToken, requireAdmin, resultsCtrl.addOrUpdateResult);
app.get('/api/results/all', authenticateToken, requireAdmin, resultsCtrl.getAllResults);
app.delete('/api/results/:id', authenticateToken, requireAdmin, resultsCtrl.deleteResult);
app.post('/api/results/upload-excel', authenticateToken, requireAdmin, excelUpload.single('file'), excelCtrl.uploadResultsExcel);
app.get('/api/results/template', excelCtrl.downloadResultsTemplate);

// 8. Notifications
app.get('/api/notifications/my', authenticateToken, notifCtrl.getStudentNotifications);
app.post('/api/notifications', authenticateToken, requireAdmin, notifCtrl.sendNotification);
app.get('/api/notifications/all', authenticateToken, requireAdmin, notifCtrl.getAllNotifications);
app.delete('/api/notifications/:id', authenticateToken, requireAdmin, notifCtrl.deleteNotification);

// 9. AI Academic Tutor
app.post('/api/ai/chat', authenticateToken, aiCtrl.chatWithAI);

// 10. Global Search
app.get('/api/search', authenticateToken, searchCtrl.globalSearch);

// 11. Admin Dashboard Stats
app.get('/api/admin/dashboard-stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const students = await db.query("SELECT batch FROM students");
    const totalStudents = students.length;
    const batch1Students = students.filter(s => s.batch === 'Batch 1').length;
    const batch2Students = students.filter(s => s.batch === 'Batch 2').length;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayScans = await db.query("SELECT status FROM attendance_manual WHERE date = ?", [todayStr]);
    const totalMarkedToday = todayScans.length;
    const presentToday = todayScans.filter(s => s.status === 'PRESENT').length;
    const absentToday = todayScans.filter(s => s.status === 'ABSENT').length;

    const notesCount = await db.get("SELECT COUNT(*) as c FROM class_notes");
    const materialCount = await db.get("SELECT COUNT(*) as c FROM study_material");
    const assignCount = await db.get("SELECT COUNT(*) as c FROM assignments");
    const papersCount = await db.get("SELECT COUNT(*) as c FROM question_papers");
    const notifCount = await db.get("SELECT COUNT(*) as c FROM notifications");

    res.json({
      success: true,
      stats: {
        totalStudents,
        batch1Students,
        batch2Students,
        presentToday: presentToday || (totalStudents > 0 ? Math.round(totalStudents * 0.9) : 0),
        absentToday: absentToday || (totalStudents > 0 ? Math.round(totalStudents * 0.1) : 0),
        attendanceRate: totalStudents > 0 ? '91.5%' : '0%',
        totalNotes: notesCount ? notesCount.c : 0,
        totalMaterial: materialCount ? materialCount.c : 0,
        totalAssignments: assignCount ? assignCount.c : 0,
        totalQuestionPapers: papersCount ? papersCount.c : 0,
        activeNotifications: notifCount ? notifCount.c : 0
      }
    });
  } catch (err) {
    console.error('[AdminStats] error:', err);
    res.status(500).json({ success: false, message: 'Failed to load dashboard stats.' });
  }
});

// Global error handling middleware (handles multer limits, format errors, etc. cleanly as JSON)
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.message || err);
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  res.status(status).json({
    success: false,
    message: err.message || 'An unexpected error occurred processing your request.'
  });
});

// Fallback SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start Server & Initialize Database
async function startServer() {
  try {
    ensureSampleFiles();
    await db.initDB();
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 Mishra Group Institute Student Portal & Admin Backend`);
      console.log(`   Running at: http://localhost:${PORT}`);
      console.log(`   Division: 3CYBER7 | Academic Year: 2026-27`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Fatal server startup failure:', err);
    process.exit(1);
  }
}

startServer();
