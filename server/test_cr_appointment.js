// Test suite verifying Admin CR appointment & live CR room change capability
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('./db');
const studentController = require('./controllers/studentController');
const authController = require('./controllers/authController');
const timetableController = require('./controllers/timetableController');

async function testCRAppointmentFlow() {
    console.log('=====================================================');
    console.log('🧪 TESTING ADMIN CR APPOINTMENT & TIMETABLE EDIT FLOW');
    console.log('=====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
            failed++;
        }
    }

    try {
        await db.initDB();

        // 1. Create a fresh test student who is NOT a CR
        await db.run("DELETE FROM students WHERE ug_id = 'TEST_APPOINT_CR'");
        await db.run("DELETE FROM timetable WHERE subject = 'TEST_CR_SUBJECT'");
        await db.run("DELETE FROM timetable_overrides WHERE date = '2026-09-07'");

        const insStudent = await db.run(`
            INSERT INTO students (ug_id, name, password_hash, roll_number, batch, division, is_cr, cr_batches)
            VALUES ('TEST_APPOINT_CR', 'Appoint Test Student', 'hash', 995, 'Batch 1', '3CYBER7', 0, 'None')
        `);
        const testStudentId = insStudent.id;

        // 2. Create a test timetable slot
        const insSlot = await db.run(`
            INSERT INTO timetable (day, start_time, end_time, subject, teacher, room, batch, division, semester, year, program, academic_year, is_lab, active)
            VALUES ('Monday', '11:00 AM', '12:00 PM', 'TEST_CR_SUBJECT', 'Prof. Test', '101', 'Batch 1', '3CYBER7', '3rd Semester', '2nd Year', 'B.Tech Cyber Security', '2026-27', 0, 1)
        `);
        const testSlotId = insSlot.id;

        // Verify initial state: student is NOT a CR
        const initialStudent = await db.get("SELECT * FROM students WHERE id = ?", [testStudentId]);
        assert(initialStudent.is_cr === 0, "Initial student has is_cr = 0");

        // 3. Admin appoints student as CR (Batch 1 + Batch 2 / Both)
        console.log('\n🔹 [Step 1] Admin calls toggleCRStatus to appoint CR...');
        let mockReq = {
            params: { id: testStudentId },
            body: { is_cr: 1, cr_batches: 'Both' }
        };
        let resData = null;
        let mockRes = {
            status: function(code) { return this; },
            json: function(data) { resData = data; return this; }
        };

        await studentController.toggleCRStatus(mockReq, mockRes);
        assert(resData && resData.success === true, "toggleCRStatus returned success: true");
        assert(resData && resData.is_cr === 1 && resData.cr_batches === 'Both', "Returned is_cr = 1 and cr_batches = 'Both'");

        // Verify in database
        const updatedStudent = await db.get("SELECT * FROM students WHERE id = ?", [testStudentId]);
        assert(updatedStudent.is_cr === 1 && updatedStudent.cr_batches === 'Both', "Database confirmed student is_cr = 1 and cr_batches = 'Both'");

        // 4. Student calls /api/auth/profile
        console.log('\n🔹 [Step 2] Student fetches profile via /api/auth/profile...');
        let profileReq = {
            user: { role: 'STUDENT', id: testStudentId, ug_id: 'TEST_APPOINT_CR' }
        };
        let profileData = null;
        let profileRes = {
            status: function(c) { return this; },
            json: function(d) { profileData = d; return this; }
        };
        await authController.getProfile(profileReq, profileRes);
        assert(profileData && profileData.success === true, "Profile endpoint returned success");
        assert(profileData && profileData.user && profileData.user.is_cr === 1, "Profile confirmed is_cr = 1");
        assert(profileData && profileData.user && profileData.user.cr_batches === 'Both', "Profile confirmed cr_batches = 'Both'");

        // 5. Newly appointed CR performs room change: 101 -> 108
        console.log('\n🔹 [Step 3] Newly appointed CR performs Room Change (101 -> 108)...');
        let changeReq = {
            user: { id: testStudentId, ug_id: 'TEST_APPOINT_CR', role: 'STUDENT' },
            body: {
                timetable_id: testSlotId,
                batch: 'Batch 1',
                day: 'Monday',
                date: '2026-09-07',
                start_time: '11:00 AM',
                end_time: '12:00 PM',
                new_room: '108',
                change_type: 'DATE'
            }
        };
        let changeResData = null;
        let changeResStatus = 200;
        let changeRes = {
            status: function(code) { changeResStatus = code; return this; },
            json: function(data) { changeResData = data; return this; }
        };
        await timetableController.createRoomChangeOverride(changeReq, changeRes);
        assert(changeResStatus === 200, `Room change succeeded with HTTP 200 (Actual: ${changeResStatus})`);
        assert(changeResData && changeResData.success === true, `Room change successfully saved for Room 108`);

        // 6. Verify student timetable reflects the room change
        console.log('\n🔹 [Step 4] Verify student timetable has new Room 108...');
        let ttReq = {
            user: { id: testStudentId, role: 'STUDENT', batch: 'Batch 1', division: '3CYBER7' },
            query: { date: '2026-09-07' }
        };
        let ttData = null;
        let ttRes = {
            status: function(c) { return this; },
            json: function(d) { ttData = d.data; return this; }
        };
        await timetableController.getStudentTimetable(ttReq, ttRes);
        const changedSlot = ttData ? ttData.find(s => s.subject === 'TEST_CR_SUBJECT') : null;
        assert(changedSlot && changedSlot.room === '108', `Timetable displays Room 108 (Actual: ${changedSlot?.room})`);
        assert(changedSlot && (changedSlot.has_room_change || changedSlot.is_room_changed), "Timetable slot has room change indicator");

        // 7. Admin removes CR status
        console.log('\n🔹 [Step 5] Admin removes CR status...');
        mockReq.body = { is_cr: 0 };
        await studentController.toggleCRStatus(mockReq, mockRes);
        assert(resData && resData.is_cr === 0, "Student removed from CR role (is_cr = 0)");

        // 8. Former CR tries to change room again -> MUST BE REJECTED (HTTP 403)
        console.log('\n🔹 [Step 6] Former CR attempting room change is blocked...');
        changeReq.body.new_room = '109';
        changeResStatus = 200;
        changeResData = null;
        await timetableController.createRoomChangeOverride(changeReq, changeRes);
        assert(changeResStatus === 403, `Unauthorized room change rejected with HTTP 403 (Actual: ${changeResStatus})`);

        // Clean up
        await db.run("DELETE FROM students WHERE ug_id = 'TEST_APPOINT_CR'");
        await db.run("DELETE FROM timetable WHERE subject = 'TEST_CR_SUBJECT'");
        await db.run("DELETE FROM timetable_overrides WHERE date = '2026-09-07'");
        await db.run("DELETE FROM timetable_override_history WHERE subject = 'TEST_CR_SUBJECT'");

    } catch (err) {
        console.error('💥 Test execution error:', err);
        failed++;
    }

    console.log('\n=====================================================');
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=====================================================');

    if (failed > 0) process.exit(1);
    else process.exit(0);
}

testCRAppointmentFlow();
