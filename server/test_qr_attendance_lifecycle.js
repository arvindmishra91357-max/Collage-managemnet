const http = require('http');
const assert = require('assert');
const app = require('./server');
const db = require('./db');
const { generateToken } = require('./middleware/auth');

let server;
let port = 3002;

function makeRequest(path, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runQRVerificationTests() {
  console.log('====================================================');
  console.log('🧪 TESTING DYNAMIC QR ATTENDANCE LIFECYCLE & ROTATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(desc, fn) {
    try {
      fn();
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${desc}`);
      console.error('    Error:', err.message);
      failed++;
    }
  }

  try {
    await db.initDB();
    const { startServer } = require('./server');
    server = await startServer(port);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Prepare auth tokens
    const teacherToken = generateToken({
      id: 999,
      teacher_id: 'TESTTEACHER',
      name: 'Prof. N. Wagh',
      role: 'TEACHER',
      subjects: 'DBMS, NCS'
    });

    // Student 1: Batch 1 (Arvind Kumar, Roll 13, 26UG033181)
    const student1Token = generateToken({
      id: 13,
      ug_id: '26UG033181',
      name: 'ARVIND KUMAR',
      roll_number: 13,
      batch: 'Batch 1',
      role: 'STUDENT'
    });

    // Student 2: Batch 2 (Soni Parth, Roll 31, 26UG035774)
    const student2Token = generateToken({
      id: 31,
      ug_id: '26UG035774',
      name: 'SONI PARTH JIGNESHBHAI',
      roll_number: 31,
      batch: 'Batch 2',
      role: 'STUDENT'
    });

    // 1. Teacher launches Dynamic QR Session for DBMS (Batch 1 Only)
    console.log('[1/5] Testing QR Session Launch & Rotation Endpoints...');
    const startRes = await makeRequest('/api/teacher/attendance/session', 'POST', {
      subject: 'DBMS',
      batch: 'Batch 1',
      duration_minutes: 30,
      qr_refresh_interval: 15
    }, teacherToken);

    test('Teacher starts QR session', () => {
      assert(startRes.status === 201 && startRes.data.success, 'Status must be 201');
      assert(startRes.data.session.id, 'Must return session id');
      assert(startRes.data.session.initial_token, 'Must return initial token');
      assert(startRes.data.session.initial_qr_image, 'Must return initial QR image data URL');
    });

    const sessionId = startRes.data.session.id;
    const initialToken = startRes.data.session.initial_token;

    // 2. Test live-token endpoints (both student and teacher aliases)
    const liveTok1 = await makeRequest(`/api/attendance/session/${sessionId}/live-token`, 'GET');
    test('Route /api/attendance/session/:id/live-token returns active token and QR image', () => {
      assert(liveTok1.status === 200 && liveTok1.data.success);
      assert(liveTok1.data.token, 'Token string present');
      assert(liveTok1.data.qr_image.startsWith('data:image/png;base64,'), 'QR base64 image generated');
    });

    const liveTok2 = await makeRequest(`/api/teacher/attendance/session/${sessionId}/live-token`, 'GET');
    test('Teacher alias route /api/teacher/attendance/session/:id/live-token returns active token', () => {
      assert(liveTok2.status === 200 && liveTok2.data.success);
      assert(liveTok2.data.token, 'Token string present');
    });

    // 3. Student Scanning & Verification
    console.log('\n[2/5] Testing Student Scan Verifications & Batch Filtering...');

    // A. Batch Mismatch: Student 2 (Batch 2) tries scanning Batch 1 session -> MUST FAIL 403
    const batchFailScan = await makeRequest('/api/attendance/scan', 'POST', {
      token: liveTok1.data.token
    }, student2Token);
    test('Batch mismatch is rejected with 403 status', () => {
      assert(batchFailScan.status === 403, `Expected 403, got ${batchFailScan.status}`);
      assert(batchFailScan.data.success === false);
      assert(batchFailScan.data.message.includes('designated for Batch 1'));
    });

    // B. Matching Batch: Student 1 (Batch 1) scans valid token -> MUST SUCCEED 200
    const validScan = await makeRequest('/api/attendance/scan', 'POST', {
      token: liveTok1.data.token
    }, student1Token);
    test('Matching batch student attendance marked PRESENT successfully', () => {
      assert(validScan.status === 200, `Expected 200, got ${validScan.status}`);
      assert(validScan.data.success === true);
      assert(validScan.data.message.includes('Attendance Verified & Marked PRESENT'));
    });

    // C. Duplicate Scan: Student 1 attempts to scan again -> MUST BE REJECTED WITH 409
    const dupScan = await makeRequest('/api/attendance/scan', 'POST', {
      token: liveTok1.data.token
    }, student1Token);
    test('Duplicate scan rejected with 409 Conflict', () => {
      assert(dupScan.status === 409, `Expected 409, got ${dupScan.status}`);
      assert(dupScan.data.success === false);
      assert(dupScan.data.message.includes('already marked attendance'));
    });

    // 4. Token Format Flexibility (JSON & URL Query Param parsing)
    console.log('\n[3/5] Testing Token Parsing & Tolerance Flexibility...');

    // Verify initialToken still valid within 4 intervals (~60s window)
    const initialTokenScan = await makeRequest('/api/attendance/scan', 'POST', {
      token: initialToken
    }, student2Token); // Reaches batch check, proving token passed verification!
    test('Token within tolerance window verifies successfully', () => {
      assert(initialTokenScan.status === 403, 'Token valid, reaches batch check');
    });

    // Malformed token test -> MUST RETURN 400
    const malformedScan = await makeRequest('/api/attendance/scan', 'POST', {
      token: 'invalid_malformed_token'
    }, student1Token);
    test('Malformed token rejected with 400 Bad Request', () => {
      assert(malformedScan.status === 400);
      assert(malformedScan.data.message.includes('Invalid QR token format'));
    });

    // 5. Live Scanned Students Tracking in Teacher Hub
    console.log('\n[4/5] Testing Teacher Live Scans List & Student Attendance Summary...');
    const liveScansRes = await makeRequest(`/api/teacher/attendance/session/${sessionId}/live-scans`, 'GET', null, teacherToken);
    test('Teacher live scans list reflects scanned student in real-time', () => {
      assert(liveScansRes.status === 200 && liveScansRes.data.success);
      assert(liveScansRes.data.presentCount >= 1, 'Present count at least 1');
      const foundStudent = liveScansRes.data.scans.find(s => s.ug_id === '26UG033181');
      assert(foundStudent, 'Student record found in scans');
      assert(foundStudent.status === 'PRESENT', 'Status is PRESENT');
    });

    // Check student attendance summary
    const studentSummary = await makeRequest('/api/attendance/student-summary', 'GET', null, student1Token);
    test('Student summary reflects recorded QR attendance', () => {
      assert(studentSummary.status === 200 && studentSummary.data.success);
      assert(studentSummary.data.stats.present >= 1);
      const hist = studentSummary.data.history.find(h => h.subject === 'DBMS');
      assert(hist && hist.status === 'PRESENT');
    });

    // 6. Stop Session
    console.log('\n[5/5] Testing Session Stop & Post-Expiry Blocking...');
    const stopRes = await makeRequest(`/api/teacher/attendance/session/${sessionId}/stop`, 'POST', {}, teacherToken);
    test('Teacher stops session successfully', () => {
      assert(stopRes.status === 200 && stopRes.data.success);
    });

    // Scan after session stopped -> MUST FAIL 400
    const postStopScan = await makeRequest('/api/attendance/scan', 'POST', {
      token: liveTok1.data.token
    }, student2Token);
    test('Scanning stopped session rejected with 400', () => {
      assert(postStopScan.status === 400);
      assert(postStopScan.data.message.includes('no longer active'));
    });

    // Cleanup
    await db.run('DELETE FROM attendance_sessions WHERE id = ?', [sessionId]);
    await db.run('DELETE FROM attendance_records WHERE session_id = ?', [sessionId]);
    await db.run("DELETE FROM attendance_manual WHERE date = (SELECT strftime('%Y-%m-%d', 'now')) AND subject = 'DBMS' AND ug_id = '26UG033181'");

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    if (server) server.close();
  }

  console.log('\n====================================================');
  console.log(`📊 QR ATTENDANCE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runQRVerificationTests();
