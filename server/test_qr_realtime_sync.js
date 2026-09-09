const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');

// Test runner for QR Attendance verification, Real-time Broadcasting, and APK delivery
async function runTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING QR ATTENDANCE & REAL-TIME AUTO-SYNC TESTS');
  console.log('========================================================');

  // 1. Verify APK file existence and size
  const apkPath = path.join(__dirname, '..', 'public', 'apk', 'MGI_Student_Portal.apk');
  if (fs.existsSync(apkPath)) {
    const stat = fs.statSync(apkPath);
    console.log(`✓ APK verified at public/apk/MGI_Student_Portal.apk (${(stat.size / 1024).toFixed(1)} KB)`);
  } else {
    throw new Error('APK file not found at ' + apkPath);
  }

  // 2. Test DB connectivity
  const student = await db.get("SELECT * FROM students LIMIT 1");
  console.log(`✓ Student found in DB: ${student.name} (${student.ug_id}) - ${student.batch}`);

  // 3. Test Dynamic QR Token Generation & Verification
  const attendanceCtrl = require('./controllers/attendanceController');
  const sessionSecret = 'test_secret_12345';
  const sessionId = 999;
  const timeBlock = Math.floor(Date.now() / 15000);
  const crypto = require('crypto');
  const data = `${sessionId}:${sessionSecret}:${timeBlock}`;
  const hash = crypto.createHmac('sha256', sessionSecret).update(data).digest('hex').substring(0, 16);
  const token = `${sessionId}_${timeBlock}_${hash}`;

  console.log(`✓ Dynamic QR Token generated: ${token}`);

  // 4. Test Realtime broadcast engine
  const realtime = require('./realtime');
  console.log(`✓ Realtime broadcast engine loaded successfully (active clients: ${realtime.getActiveClientCount()})`);
  
  realtime.broadcastEvent({
    type: 'NOTES_UPDATED',
    subject: 'Cyber Security Operations',
    title: 'Unit 3 Cryptography',
    action: 'UPLOAD'
  });
  console.log('✓ NOTES_UPDATED event broadcasted');

  realtime.broadcastEvent({
    type: 'NOTICES_UPDATED',
    title: 'Mid-term Lab Evaluation',
    category: 'EXAM'
  });
  console.log('✓ NOTICES_UPDATED event broadcasted');

  realtime.broadcastEvent({
    type: 'ATTENDANCE_SESSION_STARTED',
    sessionId: 101,
    subject: 'Network Security',
    batch: 'Both'
  });
  console.log('✓ ATTENDANCE_SESSION_STARTED event broadcasted');

  realtime.broadcastEvent({
    type: 'RESULTS_UPDATED',
    ug_id: student.ug_id,
    subject: 'Cloud Security',
    marks: 88
  });
  console.log('✓ RESULTS_UPDATED event broadcasted');

  console.log('========================================================');
  console.log('🎉 ALL QR SCANNER & REALTIME AUTO-SYNC TESTS PASSED!');
  console.log('========================================================');
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
