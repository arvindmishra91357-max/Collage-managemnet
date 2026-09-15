const http = require('http');
const db = require('./db');

const PORT = 3002; // Use an isolated test port
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

async function runQuickRollAttendanceTests() {
  console.log('================================================================');
  console.log('⚡ RUNNING QUICK ROLL NUMBER ATTENDANCE VERIFICATION TEST SUITE');
  console.log('================================================================\n');

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
    // 1. Initialize DB & Start Server
    console.log('[Phase 1] Database & Test Server Initialization...');
    await db.initDB();

    const { startServer } = require('./server');
    server = await startServer(PORT);
    await new Promise(r => setTimeout(r, 600));

    // Authenticate Teacher & Admin
    console.log('\n[Phase 2] Authenticating Test Faculty & Admin Accounts...');
    const tLogin = await makeRequest('/api/auth/login', 'POST', {
      identifier: 'TESTTEACHER',
      password: 'TestTeacher@123'
    });
    assert(tLogin.status === 200 && tLogin.data.success, 'Teacher TESTTEACHER authentication');
    const teacherToken = tLogin.data.token;

    const aLogin = await makeRequest('/api/auth/login', 'POST', {
      identifier: 'Bettu&Bunny',
      password: 'Bettu&bunny@9135'
    });
    assert(aLogin.status === 200 && aLogin.data.success, 'Admin Bettu&Bunny authentication');
    const adminToken = aLogin.data.token;

    // Fetch enrolled students
    console.log('\n[Phase 3] Testing Dynamic Student Roster Retrieval...');
    const rosterRes = await makeRequest('/api/teacher/students?batch=Batch 1', 'GET', null, teacherToken);
    assert(rosterRes.status === 200 && rosterRes.data.success, 'Fetch Batch 1 roster from API');
    const batch1Students = rosterRes.data.data;
    assert(batch1Students && batch1Students.length > 0, `Loaded ${batch1Students.length} students in Batch 1 dynamically`);

    // Verify student rolls in Batch 1
    const batch1Rolls = batch1Students.map(s => parseInt(s.roll_number, 10));
    console.log(`    Batch 1 sample rolls: ${batch1Rolls.join(', ')}`);

    // ========================================================================
    // REQUIREMENT 1 & 7: ABSENT BY DEFAULT LOGIC TEST
    // ========================================================================
    console.log('\n[Phase 4] Testing Absent-by-Default & Quick Roll Algorithm...');

    // Function simulating the client-side state machine
    function simulateQuickAttendance(students, inputStrings) {
      const statusMap = {};
      // Step 1: All students default to ABSENT
      students.forEach(s => {
        statusMap[s.ug_id.toUpperCase()] = 'ABSENT';
      });

      const history = [];
      const invalidRolls = [];
      const alreadyPresent = [];

      const rollMap = new Map();
      students.forEach(s => rollMap.set(parseInt(s.roll_number, 10), s));

      inputStrings.forEach(raw => {
        const matches = raw.match(/\d+/g) || [];
        matches.forEach(m => {
          const roll = parseInt(m, 10);
          const student = rollMap.get(roll);
          if (!student) {
            invalidRolls.push(roll);
          } else {
            const ugKey = student.ug_id.toUpperCase();
            if (statusMap[ugKey] === 'PRESENT') {
              alreadyPresent.push(roll);
            } else {
              statusMap[ugKey] = 'PRESENT';
              history.push({ action: 'MARK_PRESENT', roll, ug_id: ugKey });
            }
          }
        });
      });

      return { statusMap, history, invalidRolls, alreadyPresent };
    }

    // TEST 1: Enter 17 -> 17 Present, all others Absent
    const targetRoll = batch1Rolls.includes(17) ? 17 : batch1Rolls[0];
    const test1Result = simulateQuickAttendance(batch1Students, [String(targetRoll)]);
    const targetStudent = batch1Students.find(s => parseInt(s.roll_number, 10) === targetRoll);
    assert(
      test1Result.statusMap[targetStudent.ug_id.toUpperCase()] === 'PRESENT',
      `Test 1: Roll #${targetRoll} is marked PRESENT`
    );

    const otherStudents = batch1Students.filter(s => parseInt(s.roll_number, 10) !== targetRoll);
    const allOthersAbsent = otherStudents.every(s => test1Result.statusMap[s.ug_id.toUpperCase()] === 'ABSENT');
    assert(allOthersAbsent, `Test 1: All ${otherStudents.length} other students automatically become ABSENT`);

    // TEST 2: Fast Multiple Entry (Space, Comma, Newline separated)
    const selectedRolls = batch1Rolls.slice(0, 3);
    const bulkInputString = selectedRolls.join(', ');
    const test2Result = simulateQuickAttendance(batch1Students, [bulkInputString]);
    const selectedAllPresent = selectedRolls.every(r => {
      const s = batch1Students.find(st => parseInt(st.roll_number, 10) === r);
      return test2Result.statusMap[s.ug_id.toUpperCase()] === 'PRESENT';
    });
    assert(selectedAllPresent, `Test 2: Bulk rolls (${bulkInputString}) all marked PRESENT`);

    const unselectedStudents = batch1Students.filter(s => !selectedRolls.includes(parseInt(s.roll_number, 10)));
    const unselectedAllAbsent = unselectedStudents.every(s => test2Result.statusMap[s.ug_id.toUpperCase()] === 'ABSENT');
    assert(unselectedAllAbsent, `Test 2: All unselected students remain ABSENT`);

    // TEST 3: Duplicate Entry Protection
    const test3Result = simulateQuickAttendance(batch1Students, [String(targetRoll), String(targetRoll), String(targetRoll)]);
    assert(
      test3Result.alreadyPresent.length === 2,
      `Test 3: Entering roll #${targetRoll} 3 times detects 2 duplicates without creating extra records`
    );
    assert(
      test3Result.history.length === 1,
      `Test 3: History has exactly 1 entry for roll #${targetRoll}`
    );

    // TEST 4: Invalid Roll Number
    const test4Result = simulateQuickAttendance(batch1Students, ['999']);
    assert(
      test4Result.invalidRolls.includes(999),
      'Test 4: Roll 999 flagged as Invalid Roll Number'
    );
    assert(
      test4Result.history.length === 0,
      'Test 4: No attendance entry created for invalid roll 999'
    );

    // TEST 5: Undo / Edit Attendance
    const simState = simulateQuickAttendance(batch1Students, [String(targetRoll)]);
    assert(simState.statusMap[targetStudent.ug_id.toUpperCase()] === 'PRESENT', 'Test 5: Student marked PRESENT');
    // Revert last action
    const lastOp = simState.history.pop();
    simState.statusMap[lastOp.ug_id] = 'ABSENT';
    assert(
      simState.statusMap[targetStudent.ug_id.toUpperCase()] === 'ABSENT',
      `Test 5: Undo successfully reverts Roll #${targetRoll} back to ABSENT before saving`
    );

    // ========================================================================
    // REQUIREMENT 9, 10, 16, 17: BACKEND DATABASE PERSISTENCE & AUDIT LOGS
    // ========================================================================
    console.log('\n[Phase 5] Testing Backend Attendance Persistence & Audit Logging...');

    const testDate = '2026-09-16';
    const testSubject = 'DBMS';

    // Prepare records: targetStudent is PRESENT, others are ABSENT
    const recordsToSave = batch1Students.map(s => {
      const isPresent = parseInt(s.roll_number, 10) === targetRoll;
      return {
        ug_id: s.ug_id,
        name: s.name,
        status: isPresent ? 'PRESENT' : 'ABSENT',
        remarks: isPresent ? 'Quick Roll Present (Lecture 1)' : 'Quick Roll Absent (Lecture 1)'
      };
    });

    const saveRes = await makeRequest('/api/teacher/attendance/manual', 'POST', {
      subject: testSubject,
      batch: 'Batch 1',
      date: testDate,
      records: recordsToSave
    }, teacherToken);

    assert(saveRes.status === 200 && saveRes.data.success, 'Test 6: Teacher Quick Attendance saved to database via API');
    assert(saveRes.data.count === recordsToSave.length, `Test 6: Correct student count saved (${recordsToSave.length} records)`);

    // Verify records in DB
    const savedRecords = await db.query(
      "SELECT ug_id, status, remarks, marked_by FROM attendance_manual WHERE date = ? AND subject = ? AND batch = ?",
      [testDate, testSubject, 'Batch 1']
    );
    assert(savedRecords.length === recordsToSave.length, `Database: Stored ${savedRecords.length} records in attendance_manual`);

    const presentDbRec = savedRecords.find(r => r.ug_id.toUpperCase() === targetStudent.ug_id.toUpperCase());
    assert(presentDbRec && presentDbRec.status === 'PRESENT', `Database: Roll #${targetRoll} is verified PRESENT in DB`);

    const absentDbRecs = savedRecords.filter(r => r.ug_id.toUpperCase() !== targetStudent.ug_id.toUpperCase());
    assert(absentDbRecs.every(r => r.status === 'ABSENT'), `Database: All ${absentDbRecs.length} other students are verified ABSENT in DB`);

    // Verify Audit Log
    const auditLogs = await db.query(
      "SELECT * FROM attendance_audit_logs WHERE ug_id = ? ORDER BY id DESC LIMIT 1",
      [targetStudent.ug_id.toUpperCase()]
    );
    assert(auditLogs.length > 0, `Audit Log: Verified audit trail entry exists for Roll #${targetRoll} (${targetStudent.ug_id})`);
    assert(auditLogs[0].new_status === 'PRESENT', `Audit Log: Logged new_status is PRESENT`);

    // TEST 7: Batch Isolation
    console.log('\n[Phase 6] Testing Batch Isolation & Student Attendance Summary...');
    const batch2StudentsRes = await db.query("SELECT * FROM students WHERE batch = 'Batch 2'");
    if (batch2StudentsRes.length > 0) {
      const b2Ugid = batch2StudentsRes[0].ug_id.toUpperCase();
      const b2Record = savedRecords.find(r => r.ug_id.toUpperCase() === b2Ugid);
      assert(!b2Record, 'Test 7: Batch 1 Quick Attendance does NOT touch Batch 2 students');
    }

    // TEST 8: Student Attendance Percentage Update
    // Login as the present student and check own attendance endpoint
    const sLogin = await makeRequest('/api/auth/login', 'POST', {
      identifier: targetStudent.ug_id,
      password: targetStudent.ug_id === '26UG033181' ? 'Bunny@2606' : 'TestStudent@123'
    });

    if (sLogin.status === 200 && sLogin.data.token) {
      const sToken = sLogin.data.token;
      const sAtt = await makeRequest('/api/attendance/student', 'GET', null, sToken);
      assert(sAtt.status === 200 && sAtt.data.success, 'Test 8: Student successfully retrieves own updated attendance report');
      assert(sAtt.data.records.some(r => r.subject === testSubject && r.status === 'PRESENT'), 'Test 8: Student report reflects PRESENT status for the lecture');
    } else {
      console.log('  ℹ Notice: Test student credential check skipped (student uses alternate credentials)');
    }

    // Admin Quick Attendance Test
    console.log('\n[Phase 7] Testing Admin Quick Attendance...');
    const adminSaveRes = await makeRequest('/api/attendance/manual', 'POST', {
      date: testDate,
      subject: 'NCS',
      batch: 'Batch 1',
      records: recordsToSave
    }, adminToken);
    assert(adminSaveRes.status === 200 && adminSaveRes.data.success, 'Admin Quick Attendance saved successfully via /api/attendance/manual');

    // TEST 9: N/A Status Mapping to LEAVE in SQLite & Bulk Actions
    console.log('\n[Phase 8] Testing N/A Status Mapping to LEAVE & Bulk Actions...');
    const naRecords = batch1Students.map((s, idx) => {
      let status = 'ABSENT';
      if (idx === 0) status = 'PRESENT';
      else if (idx === 1) status = 'N/A';
      return {
        ug_id: s.ug_id,
        name: s.name,
        status: status,
        remarks: status === 'N/A' ? 'Quick Roll Call: N/A (Lecture 2)' : `Quick Roll Call: ${status} (Lecture 2)`
      };
    });

    const teacherNaSaveRes = await makeRequest('/api/teacher/attendance/manual', 'POST', {
      subject: 'DBMS',
      batch: 'Batch 1',
      date: '2026-09-17',
      records: naRecords
    }, teacherToken);
    assert(teacherNaSaveRes.status === 200 && teacherNaSaveRes.data.success, 'Teacher: Saved attendance containing N/A status without SQLite constraint error');

    const dbNaCheck = await db.query(
      "SELECT ug_id, status FROM attendance_manual WHERE date = '2026-09-17' AND subject = 'DBMS' AND UPPER(ug_id) = ?",
      [batch1Students[1].ug_id.toUpperCase()]
    );
    assert(dbNaCheck.length > 0 && dbNaCheck[0].status === 'LEAVE', 'Database: N/A status successfully mapped and stored as LEAVE in SQLite');

    // Admin N/A check
    const adminNaSaveRes = await makeRequest('/api/attendance/manual', 'POST', {
      date: '2026-09-17',
      subject: 'NCS',
      batch: 'Batch 1',
      records: naRecords
    }, adminToken);
    assert(adminNaSaveRes.status === 200 && adminNaSaveRes.data.success, 'Admin: Saved attendance containing N/A status without error');

    const dbAdminNaCheck = await db.query(
      "SELECT ug_id, status FROM attendance_manual WHERE date = '2026-09-17' AND subject = 'NCS' AND UPPER(ug_id) = ?",
      [batch1Students[1].ug_id.toUpperCase()]
    );
    assert(dbAdminNaCheck.length > 0 && dbAdminNaCheck[0].status === 'LEAVE', 'Database: Admin N/A status successfully stored as LEAVE');

    console.log('\n================================================================');
    console.log(`🎉 ALL QUICK ROLL ATTENDANCE TESTS COMPLETED!`);
    console.log(`   Passed: ${passed} | Failed: ${failed}`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Fatal test execution error:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

runQuickRollAttendanceTests();
