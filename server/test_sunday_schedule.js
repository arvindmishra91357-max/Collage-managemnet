const http = require('http');
const { generateToken } = require('./middleware/auth');
const PORT = 3000;

function request(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Sunday & Timetable Verification Tests...');
  const studentToken = generateToken({
    id: 1,
    ug_id: '26UG033181',
    role: 'STUDENT',
    batch: 'Batch 2',
    division: '3CYBER7',
    is_cr: 1
  });

  // Test 1: Sunday today classes
  const sundayToday = await request({
    host: '127.0.0.1',
    port: PORT,
    path: '/api/timetable/today?day=Sunday',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log('Test 1 (Sunday Today):', sundayToday.status, sundayToday.data.success, 'isSunday:', sundayToday.data.isSunday, 'classes count:', sundayToday.data.classes.length);
  if (!sundayToday.data.isSunday || sundayToday.data.classes.length !== 0) {
    throw new Error('Test 1 failed: Sunday today classes should be empty and isSunday true');
  }

  // Test 2: Sunday timetable tab
  const sundayTimetable = await request({
    host: '127.0.0.1',
    port: PORT,
    path: '/api/timetable?day=Sunday',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log('Test 2 (Sunday Timetable):', sundayTimetable.status, sundayTimetable.data.success, 'isSunday:', sundayTimetable.data.isSunday, 'slots count:', sundayTimetable.data.data.length);
  if (!sundayTimetable.data.isSunday || sundayTimetable.data.data.length !== 0) {
    throw new Error('Test 2 failed: Sunday timetable should be empty and isSunday true');
  }

  // Test 3: Monday today classes
  const mondayToday = await request({
    host: '127.0.0.1',
    port: PORT,
    path: '/api/timetable/today?day=Monday',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log('Test 3 (Monday Today):', mondayToday.status, mondayToday.data.success, 'isSunday:', mondayToday.data.isSunday, 'classes count:', mondayToday.data.classes.length);
  if (mondayToday.data.isSunday || mondayToday.data.classes.length === 0) {
    throw new Error('Test 3 failed: Monday should return classes');
  }

  // Test 4: Monday timetable tab
  const mondayTimetable = await request({
    host: '127.0.0.1',
    port: PORT,
    path: '/api/timetable?day=Monday',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log('Test 4 (Monday Timetable):', mondayTimetable.status, mondayTimetable.data.success, 'slots count:', mondayTimetable.data.data.length);
  if (mondayTimetable.data.data.length === 0) {
    throw new Error('Test 4 failed: Monday timetable should return slots');
  }

  console.log('✅ ALL SUNDAY & TIMETABLE TESTS PASSED SUCCESSFULLY!');
}

// Start server in-process if not already running, then run tests
const app = require('./server');
setTimeout(() => {
  runTests().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}, 1000);
