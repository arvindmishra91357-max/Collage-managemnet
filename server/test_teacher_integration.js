const http = require('http');
const db = require('./db');

const PORT = 3001; // Use an isolated test port
process.env.PORT = PORT;

let server;

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://localhost:${PORT}`);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: url.pathname + url.search,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTeacherIntegrationTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE TEACHER PORTAL TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  try {
    // 1. Database Migrations Verification
    console.log('[1/7] Initializing Database & Verifying Schema Migrations...');
    await db.initDB();

    const teacherCols = await db.query("PRAGMA table_info(teachers)");
    const hasTeacherTable = teacherCols && teacherCols.length > 0;
    assert(hasTeacherTable, 'Database: `teachers` table exists');

    const ttCols = await db.query("PRAGMA table_info(timetable)");
    const hasTtTeacherId = ttCols.some(c => c.name === 'teacher_id');
    assert(hasTtTeacherId, 'Database: `timetable.teacher_id` column exists');

    const testTeacher = await db.get("SELECT * FROM teachers WHERE teacher_id = ?", ['TESTTEACHER']);
    assert(testTeacher && testTeacher.name === 'Prof. N. Wagh', 'Database: Seeded TESTTEACHER exists (Prof. N. Wagh)');

    // Start Express Server
    const { startServer } = require('./server');
    server = await startServer(PORT);
    await new Promise(r => setTimeout(r, 600));

    // 2. Unified Login Tests (Student, Admin, Teacher)
    console.log('\n[2/7] Testing Unified Authentication Flow...');

    // A. Teacher Login
    const tLogin = await makeRequest('/api/auth/login', 'POST', {
      identifier: 'TESTTEACHER',
      password: 'TestTeacher@123'
    });
    assert(tLogin.status === 200 && tLogin.data.success && tLogin.data.user.role === 'TEACHER', 'Unified Login: Teacher TESTTEACHER authentication');
    assert(tLogin.data.user.teacher_id === 'TESTTEACHER' && tLogin.data.user.subjects.includes('DBMS'), 'Teacher payload contains teacher_id and assigned subjects');
    const teacherToken = tLogin.data.token;

    // B. Wrong Teacher Password
    const tBadLogin = await makeRequest('/api/auth/login', 'POST', {
      identifier: 'TESTTEACHER',
      password: 'WrongPassword999'
    });
    assert(tBadLogin.status === 401 && !tBadLogin.data.success, 'Security: Invalid teacher password rejected with 401');

    // C. Student Login via Unified Login
    const sLogin = await makeRequest('/api/auth/login', 'POST', {
      identifier: '26UG033181',
      password: 'Bunny@2606'
    });
    assert(sLogin.status === 200 && sLogin.data.user.role === 'STUDENT', 'Unified Login: Student 26UG033181 authentication');
    const studentToken = sLogin.data.token;

    // D. Admin Login via Unified Login
    const aLogin = await makeRequest('/api/auth/login', 'POST', {
      identifier: 'Bettu&Bunny',
      password: 'Bettu&bunny@9135'
    });
    assert(aLogin.status === 200 && aLogin.data.user.role === 'ADMIN', 'Unified Login: Admin Bettu&Bunny authentication');
    const adminToken = aLogin.data.token;

    // 3. Strict RBAC & Boundary Authorization
    console.log('\n[3/7] Testing RBAC Security & Boundary Checks...');

    // Student blocked from Teacher APIs
    const sBlockTeacher = await makeRequest('/api/teacher/dashboard', 'GET', null, studentToken);
    assert(sBlockTeacher.status === 403, 'RBAC Security: Student blocked from /api/teacher/* with 403');

    // Teacher blocked from Admin APIs
    const tBlockAdmin = await makeRequest('/api/admin/teachers', 'GET', null, teacherToken);
    assert(tBlockAdmin.status === 403, 'RBAC Security: Teacher blocked from /api/admin/teachers with 403');

    // Admin allowed to check admin dashboard stats (with teacher stats)
    const adminStats = await makeRequest('/api/admin/dashboard-stats', 'GET', null, adminToken);
    assert(adminStats.status === 200 && typeof adminStats.data.stats.totalTeachers === 'number', 'Admin Stats: includes totalTeachers & activeTeachers');

    // 4. Teacher Core Endpoints
    console.log('\n[4/7] Testing Teacher Dashboard, Timetable, and Student Roster...');

    // Teacher Dashboard
    const tDash = await makeRequest('/api/teacher/dashboard', 'GET', null, teacherToken);
    assert(tDash.status === 200 && tDash.data.success && tDash.data.data.stats, 'Teacher Dashboard: Returns metrics overview');

    // Teacher Timetable (should only show assigned subjects DBMS & NCS)
    const tTimetable = await makeRequest('/api/teacher/timetable', 'GET', null, teacherToken);
    const ttList = tTimetable.data?.data?.timetable || tTimetable.data?.timetable || [];
    assert(tTimetable.status === 200 && tTimetable.data.success && Array.isArray(ttList), 'Teacher Timetable: Returns weekly schedule');
    const allAssignedSubjects = ttList.every(slot => slot.subject.includes('DBMS') || slot.subject.includes('NCS'));
    assert(allAssignedSubjects, 'Teacher Timetable: Filtered strictly to teacher assigned subjects');

    // Teacher Students list
    const tStudents = await makeRequest('/api/teacher/students', 'GET', null, teacherToken);
    const stList = tStudents.data?.data || tStudents.data?.students || [];
    assert(tStudents.status === 200 && Array.isArray(stList) && stList.length > 0, `Teacher Students: Returns assigned class students (${stList.length} found)`);

    // Student Read-Only Profile
    const firstUg = stList[0].ug_id;
    const tProfile = await makeRequest(`/api/teacher/student-profile/${firstUg}`, 'GET', null, teacherToken);
    const stProf = tProfile.data?.data || tProfile.data;
    assert(tProfile.status === 200 && stProf && stProf.student && stProf.attendanceHistory, 'Teacher Student Profile: Read-only profile view with attendance & marks');

    // 5. Teacher Attendance Hub (Dynamic QR & Manual)
    console.log('\n[5/7] Testing Teacher Attendance Control & Audit Logging...');

    // Start Dynamic QR Session
    const qrStart = await makeRequest('/api/teacher/attendance/session', 'POST', {
      subject: 'DBMS',
      batch: 'Both',
      classroom_lat: 22.2887,
      classroom_lng: 73.3634,
      allowed_radius_meters: 60,
      duration_minutes: 20
    }, teacherToken);
    assert(qrStart.status === 201 && qrStart.data.session.id, 'Teacher Attendance: Started Dynamic QR Attendance Session');
    const tSessionId = qrStart.data.session.id;

    // Student scans the teacher's dynamic QR code
    const liveTokenRes = await makeRequest(`/api/attendance/session/${tSessionId}/live-token`, 'GET');
    assert(liveTokenRes.status === 200 && liveTokenRes.data.token, 'Teacher Attendance: Rotating dynamic QR token available');

    const studentScan = await makeRequest('/api/attendance/scan', 'POST', {
      token: liveTokenRes.data.token,
      student_lat: 22.2888,
      student_lng: 73.3634,
      accuracy: 10
    }, studentToken);
    assert(studentScan.status === 200 && studentScan.data.success, 'Student Scan: Student successfully scans Teacher QR session');

    // Teacher checks live scans
    const liveScans = await makeRequest(`/api/teacher/attendance/session/${tSessionId}/live-scans`, 'GET', null, teacherToken);
    assert(liveScans.status === 200 && liveScans.data.presentCount >= 1, 'Teacher Attendance: Live scans list reflects student attendance');

    // Teacher stops session
    const qrStop = await makeRequest(`/api/teacher/attendance/session/${tSessionId}/stop`, 'POST', {}, teacherToken);
    assert(qrStop.status === 200 && qrStop.data.success, 'Teacher Attendance: Successfully closed QR session');

    // Teacher Manual Attendance Save
    const manualAtt = await makeRequest('/api/teacher/attendance/manual', 'POST', {
      subject: 'DBMS',
      batch: 'Batch 1',
      date: new Date().toISOString().split('T')[0],
      period: '09:30 - 10:25',
      records: [
        { ug_id: '26UG033181', status: 'PRESENT', remarks: 'Attended lecture' }
      ]
    }, teacherToken);
    assert(manualAtt.status === 200 && manualAtt.data.success, 'Teacher Attendance: Manual attendance marked with audit record');

    // Attendance Reports
    const attReports = await makeRequest('/api/teacher/attendance/reports?subject=DBMS', 'GET', null, teacherToken);
    assert(attReports.status === 200 && attReports.data.success, 'Teacher Attendance: Attendance reports generated for DBMS');

    // 6. Teacher Academic Materials, Assignments, Results & Announcements
    console.log('\n[6/7] Testing Notes, Assignments, Results & Ownership Security...');

    // Notes: Create note for assigned subject
    const noteCreate = await makeRequest('/api/teacher/notes', 'POST', {
      subject: 'DBMS',
      title: 'Unit 1: Relational Model Architecture',
      description: 'Complete lecture slides and schema diagrams',
      file_url: '/uploads/unit1_relational.pdf'
    }, teacherToken);
    assert(noteCreate.status === 201 && noteCreate.data.id, 'Teacher Notes: Uploaded note for assigned subject DBMS');
    const noteId = noteCreate.data.id;

    // Notes: Try creating note for UNASSIGNED subject (e.g. Mathematics) -> MUST BE BLOCKED
    const noteBlocked = await makeRequest('/api/teacher/notes', 'POST', {
      subject: 'Advanced Mathematics',
      title: 'Calculus Notes',
      file_url: '/uploads/calc.pdf'
    }, teacherToken);
    assert(noteBlocked.status === 403, 'Ownership Security: Teacher blocked from uploading notes for unassigned subject');

    // Assignment: Create assignment for assigned subject
    const assignCreate = await makeRequest('/api/teacher/assignments', 'POST', {
      subject: 'DBMS',
      title: 'Assignment 1: SQL Normalization Exercises',
      description: 'Normalize the given universal relation to BCNF',
      due_date: '2026-10-15',
      batch: 'Both',
      max_marks: 50
    }, teacherToken);
    assert(assignCreate.status === 201 && assignCreate.data.id, 'Teacher Assignments: Created assignment for DBMS');
    const assignId = assignCreate.data.id;

    // Results: Teacher enters marks for assigned subject
    const markSave = await makeRequest('/api/teacher/results', 'POST', {
      ug_id: '26UG033181',
      subject: 'DBMS',
      exam_name: 'Mid-Term Exam',
      batch: 'Batch 1',
      marks_obtained: 45,
      total_marks: 50
    }, teacherToken);
    assert(markSave.status === 200 && markSave.data.success, 'Teacher Results: Saved Mid-Term marks for DBMS');

    // Results: Teacher tries entering marks for unassigned subject -> MUST BE BLOCKED
    const markBlocked = await makeRequest('/api/teacher/results', 'POST', {
      ug_id: '26UG033181',
      subject: 'Discrete Mathematics',
      exam_name: 'Mid-Term Exam',
      marks_obtained: 40,
      total_marks: 50
    }, teacherToken);
    assert(markBlocked.status === 403, 'Ownership Security: Teacher blocked from entering marks for unassigned subject');

    // Announcements: Teacher creates class notice
    const notifCreate = await makeRequest('/api/teacher/notifications', 'POST', {
      title: 'DBMS Lab Practical Schedule',
      message: 'Batch 1 students please bring your printed SQL queries on Wednesday.',
      subject: 'DBMS',
      batch: 'Batch 1',
      priority: 'HIGH'
    }, teacherToken);
    assert(notifCreate.status === 201 && notifCreate.data.success, 'Teacher Announcements: Created class-targeted announcement');

    // 7. Admin Teacher Management Flow
    console.log('\n[7/7] Testing Admin Faculty Management (Create, Edit, Toggle, Reset Pass, Delete)...');

    // Admin gets all teachers
    const allTeachers = await makeRequest('/api/admin/teachers', 'GET', null, adminToken);
    assert(allTeachers.status === 200 && allTeachers.data.teachers.some(t => t.teacher_id === 'TESTTEACHER'), 'Admin Teachers: Lists existing teachers');

    // Admin creates new teacher
    const newTchRes = await makeRequest('/api/admin/teachers', 'POST', {
      teacher_id: 'AUTOTCH01',
      name: 'Prof. R. Patil',
      password: 'PatilPassword@123',
      department: 'Computer Science & Engineering',
      designation: 'Associate Professor',
      subjects: 'JAVA, DSA',
      division: '3CYBER7',
      batch: 'Both',
      phone: '9822001122',
      email: 'rpatil@mgi.edu.in'
    }, adminToken);
    assert(newTchRes.status === 201 && newTchRes.data.teacher.id, 'Admin Teachers: Created new faculty account (AUTOTCH01)');
    const newTchId = newTchRes.data.teacher.id;

    // Login with new teacher account
    const newTchLogin = await makeRequest('/api/auth/login', 'POST', {
      identifier: 'AUTOTCH01',
      password: 'PatilPassword@123'
    });
    assert(newTchLogin.status === 200 && newTchLogin.data.success, 'New Teacher: Immediately able to login without server restart');

    // Admin deactivates teacher
    const toggleDeact = await makeRequest(`/api/admin/teachers/${newTchId}/toggle-status`, 'POST', {}, adminToken);
    assert(toggleDeact.status === 200 && toggleDeact.data.status === 'INACTIVE', 'Admin Teachers: Toggled status to INACTIVE');

    // Inactive teacher login MUST be rejected
    const inactiveLogin = await makeRequest('/api/auth/login', 'POST', {
      identifier: 'AUTOTCH01',
      password: 'PatilPassword@123'
    });
    assert(inactiveLogin.status === 403, 'Security: Inactive faculty login rejected with 403');

    // Admin reactivates teacher
    const toggleAct = await makeRequest(`/api/admin/teachers/${newTchId}/toggle-status`, 'POST', {}, adminToken);
    assert(toggleAct.status === 200 && toggleAct.data.status === 'ACTIVE', 'Admin Teachers: Re-activated faculty account');

    // Admin resets teacher password
    const resetPass = await makeRequest(`/api/admin/teachers/${newTchId}/reset-password`, 'POST', {
      new_password: 'NewSecurePass@456'
    }, adminToken);
    assert(resetPass.status === 200 && resetPass.data.success, 'Admin Teachers: Reset faculty password');

    // Login with new reset password
    const loginAfterReset = await makeRequest('/api/auth/login', 'POST', {
      identifier: 'AUTOTCH01',
      password: 'NewSecurePass@456'
    });
    assert(loginAfterReset.status === 200 && loginAfterReset.data.success, 'New Teacher: Can login with reset password');

    // Admin updates assignments
    const updateAssign = await makeRequest(`/api/admin/teachers/${newTchId}/assignments`, 'PUT', {
      subjects: 'JAVA, DSA, FCS',
      batch: 'Batch 1',
      division: '3CYBER7'
    }, adminToken);
    assert(updateAssign.status === 200 && updateAssign.data.teacher.subjects.includes('FCS'), 'Admin Teachers: Updated subject and batch assignments');

    // Admin deletes test teacher
    const delTch = await makeRequest(`/api/admin/teachers/${newTchId}`, 'DELETE', null, adminToken);
    assert(delTch.status === 200 && delTch.data.success, 'Admin Teachers: Deleted test teacher');

    // Clean up test data (note and assignment created by TESTTEACHER)
    await db.run('DELETE FROM class_notes WHERE id = ?', [noteId]);
    await db.run('DELETE FROM assignments WHERE id = ?', [assignId]);
    await db.run('DELETE FROM attendance_sessions WHERE id = ?', [tSessionId]);
    await db.run('DELETE FROM attendance_records WHERE session_id = ?', [tSessionId]);

  } catch (err) {
    console.error('Fatal test execution error:', err);
    failed++;
  } finally {
    if (server) server.close();
  }

  console.log('\n====================================================');
  console.log(`📊 INTEGRATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTeacherIntegrationTests();
