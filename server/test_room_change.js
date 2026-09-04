const http = require('http');
const db = require('./db');
const { generateToken } = require('./middleware/auth');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting Manual Room Change & Class Override Tests');
  console.log('====================================================');

  await db.initDB();

  const PORT = process.env.PORT || 3000;
  const host = 'localhost';

  // Helper for auth headers
  const adminToken = generateToken({ id: 1, username: 'Bettu&Bunny', role: 'ADMIN' });
  const crStudentToken = generateToken({
    id: 13,
    ug_id: '26UG033181',
    name: 'ARVIND KUMAR',
    batch: 'Batch 1',
    division: '3CYBER7',
    is_cr: 1,
    role: 'STUDENT'
  });
  const normalStudentToken = generateToken({
    id: 2,
    ug_id: '26UG032660',
    name: 'SOLANKI NISHITH ANILBHAI',
    batch: 'Batch 1',
    division: '3CYBER7',
    is_cr: 0,
    role: 'STUDENT'
  });

  // Ensure CR is set in database for Arvind Kumar
  await db.run("UPDATE students SET is_cr = 1 WHERE ug_id = '26UG033181'");
  await db.run("UPDATE students SET is_cr = 0 WHERE ug_id = '26UG032660'");

  // Get current IST date
  const now = new Date();
  const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(istString);
  const todayDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const futureDate = '2026-10-15';

  // Find a timetable slot
  const slots = await db.query("SELECT * FROM timetable WHERE active = 1 ORDER BY id ASC");
  assert(slots.length > 0, `Database has ${slots.length} timetable entries.`);
  const testSlot = slots.find(s => s.subject === 'DBMS') || slots[0];
  console.log(`Using Test Slot: #${testSlot.id} ${testSlot.subject} on ${testSlot.day} (${testSlot.start_time}–${testSlot.end_time}) in ${testSlot.room}`);

  // Test 1: Student Timetable without override returns regular room
  const ttRes = await request({
    host, port: PORT, path: `/api/timetable?day=${testSlot.day}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${normalStudentToken}` }
  });
  assert(ttRes.status === 200 && ttRes.data.success, 'Student retrieves regular timetable.');
  const slotBefore = ttRes.data.data.find(s => s.id === testSlot.id);
  assert(slotBefore && slotBefore.room === testSlot.room, `Timetable shows regular room: ${testSlot.room}`);

  // Test 2: Admin creates Date-Specific Room Change for todayDate
  const changeRes = await request({
    host, port: PORT, path: '/api/timetable/room-change',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
  }, {
    timetable_id: testSlot.id,
    date: todayDate,
    new_room: 'NB-204',
    reason: 'Lab projector repair shift'
  });
  assert(changeRes.status === 200 && changeRes.data.success, 'Admin creates date-specific room change (DBMS -> NB-204).');

  // Test 3: Today's Classes for todayDate reflect new room NB-204 with room change metadata
  const todayClassesRes = await request({
    host, port: PORT, path: `/api/timetable/today?date=${todayDate}&day=${testSlot.day}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${normalStudentToken}` }
  });
  assert(todayClassesRes.status === 200 && todayClassesRes.data.success, 'Student fetches today classes with overrides.');
  const updatedSlot = todayClassesRes.data.classes.find(s => s.id === testSlot.id);
  assert(updatedSlot && updatedSlot.room === 'NB-204', `Room updated to NB-204 on ${todayDate}`);
  assert(updatedSlot.has_room_change === true, 'Slot has_room_change is true.');
  assert(updatedSlot.original_room === testSlot.room, `Original room preserved as ${testSlot.room}`);

  // Test 4: Other dates still return the regular master timetable room
  const otherDateClassesRes = await request({
    host, port: PORT, path: `/api/timetable/today?date=${futureDate}&day=${testSlot.day}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${normalStudentToken}` }
  });
  const futureSlot = otherDateClassesRes.data.classes.find(s => s.id === testSlot.id);
  assert(futureSlot && futureSlot.room === testSlot.room, `Next scheduled class on ${futureDate} automatically uses regular room (${testSlot.room}).`);

  // Test 5: Authorized CR can perform temporary room change for today's class
  const crChangeRes = await request({
    host, port: PORT, path: '/api/timetable/room-change',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${crStudentToken}`, 'Content-Type': 'application/json' }
  }, {
    timetable_id: testSlot.id,
    date: todayDate,
    new_room: 'Room 305',
    reason: 'CR Room Change: Shifting to Room 305'
  });
  assert(crChangeRes.status === 200 && crChangeRes.data.success, 'Authorized CR successfully changes class room.');

  // Test 6: Unauthorized student is rejected with 403 Forbidden
  const unauthRes = await request({
    host, port: PORT, path: '/api/timetable/room-change',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${normalStudentToken}`, 'Content-Type': 'application/json' }
  }, {
    timetable_id: testSlot.id,
    date: todayDate,
    new_room: 'Room 999',
    reason: 'Unauthorized student attempt'
  });
  assert(unauthRes.status === 403, 'Unauthorized student room change rejected with 403 Forbidden.');

  // Test 7: Admin cancels individual class for a date
  const cancelRes = await request({
    host, port: PORT, path: '/api/timetable/cancel-class',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
  }, {
    timetable_id: testSlot.id,
    date: todayDate,
    reason: 'Faculty attending research conference'
  });
  assert(cancelRes.status === 200 && cancelRes.data.success, 'Admin cancels individual class for today.');

  // Test 8: Student view shows class as CANCELLED
  const cancelledViewRes = await request({
    host, port: PORT, path: `/api/timetable/today?date=${todayDate}&day=${testSlot.day}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${normalStudentToken}` }
  });
  const cancelledSlot = cancelledViewRes.data.classes.find(s => s.id === testSlot.id);
  assert(cancelledSlot && cancelledSlot.is_cancelled === true && cancelledSlot.status === 'CANCELLED', 'Student portal displays class as CANCELLED.');

  // Test 9: Reverting override restores regular room
  const revertRes = await request({
    host, port: PORT, path: '/api/timetable/override/revert',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
  }, {
    timetable_id: testSlot.id,
    date: todayDate
  });
  assert(revertRes.status === 200 && revertRes.data.success, 'Admin reverts override back to regular timetable.');

  // Verify reverted status
  const afterRevertRes = await request({
    host, port: PORT, path: `/api/timetable/today?date=${todayDate}&day=${testSlot.day}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${normalStudentToken}` }
  });
  const revertedSlot = afterRevertRes.data.classes.find(s => s.id === testSlot.id);
  assert(revertedSlot && revertedSlot.room === testSlot.room && !revertedSlot.is_cancelled, `Schedule restored to regular room (${testSlot.room}).`);

  // Test 10: Admin checks Override History Log
  const historyRes = await request({
    host, port: PORT, path: '/api/timetable/overrides/history',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(historyRes.status === 200 && historyRes.data.data.length >= 3, `Override history contains ${historyRes.data.data.length} audit logs.`);

  // Test 11: Admin declares Holiday
  const holidayRes = await request({
    host, port: PORT, path: '/api/admin/holidays',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
  }, {
    date: todayDate,
    title: 'Festival Holiday',
    description: 'College closed on account of festival.'
  });
  assert(holidayRes.status === 200 && holidayRes.data.success, 'Admin declares holiday for today.');

  const holidayCheckRes = await request({
    host, port: PORT, path: `/api/timetable/today?date=${todayDate}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${normalStudentToken}` }
  });
  assert(holidayCheckRes.data.isHoliday === true, 'Student timetable marks date as Holiday.');

  // Clean up holiday
  await db.run("DELETE FROM academic_holidays WHERE date = ?", [todayDate]);

  console.log('====================================================');
  console.log('🎉 ALL 11 MANUAL ROOM CHANGE & OVERRIDE TESTS PASSED!');
  console.log('====================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
