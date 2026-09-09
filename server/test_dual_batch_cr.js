// Automated Test Suite for Dual Batch CR & Room Change System
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('./db');
const timetableController = require('./controllers/timetableController');
const studentController = require('./controllers/studentController');

async function runTests() {
    console.log('=====================================================');
    console.log('🚀 STARTING DUAL BATCH CR & TIMETABLE TEST SUITE');
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

        // Step 1: Ensure database schema is initialized
        console.log('🔹 [Test 1] Database schema & columns check...');
        const studentsCols = await db.query("PRAGMA table_info(students)");
        const crBatchesCol = studentsCols.find(c => c.name === 'cr_batches');
        assert(!!crBatchesCol, "Column 'cr_batches' exists in 'students' table");

        const overrideCols = await db.query("PRAGMA table_info(timetable_overrides)");
        const overrideBatchCol = overrideCols.find(c => c.name === 'batch');
        assert(!!overrideBatchCol, "Column 'batch' exists in 'timetable_overrides' table");

        const historyCols = await db.query("PRAGMA table_info(timetable_override_history)");
        const historyBatchCol = historyCols.find(c => c.name === 'batch');
        assert(!!historyBatchCol, "Column 'batch' exists in 'timetable_override_history' table");

        // Step 2: Seed or find test students (Admin, CR Batch 1, CR Both, Student Batch 1, Student Batch 2)
        console.log('\n🔹 [Test 2] CR Permission Configuration & Admin CR Toggle...');
        
        // Clean any old test students
        await db.run("DELETE FROM students WHERE ug_id LIKE 'TEST_%'");

        // Ensure student 1 is CR for Batch 1 only
        const resCr1 = await db.run(`
            INSERT INTO students (ug_id, name, password_hash, roll_number, batch, division, is_cr, cr_batches)
            VALUES ('TEST_CR1', 'CR Batch One', 'hash', 991, 'Batch 1', '3CYBER7', 1, 'Batch 1')
        `);
        const cr1Id = resCr1.id;

        // Ensure student 2 is CR for Both batches
        const resCrBoth = await db.run(`
            INSERT INTO students (ug_id, name, password_hash, roll_number, batch, division, is_cr, cr_batches)
            VALUES ('TEST_CRBOTH', 'CR Dual Batch', 'hash', 992, 'Batch 1', '3CYBER7', 1, 'Both')
        `);
        const crBothId = resCrBoth.id;

        // Normal Student Batch 1
        const resB1 = await db.run(`
            INSERT INTO students (ug_id, name, password_hash, roll_number, batch, division, is_cr, cr_batches)
            VALUES ('TEST_B1', 'Student B1', 'hash', 993, 'Batch 1', '3CYBER7', 0, 'None')
        `);
        const b1Id = resB1.id;

        // Normal Student Batch 2
        const resB2 = await db.run(`
            INSERT INTO students (ug_id, name, password_hash, roll_number, batch, division, is_cr, cr_batches)
            VALUES ('TEST_B2', 'Student B2', 'hash', 994, 'Batch 2', '3CYBER7', 0, 'None')
        `);
        const b2Id = resB2.id;

        const cr1 = await db.get("SELECT * FROM students WHERE id = ?", [cr1Id]);
        assert(cr1.is_cr === 1 && cr1.cr_batches === 'Batch 1', "CR Batch 1 properly stored with cr_batches = 'Batch 1'");

        const crBoth = await db.get("SELECT * FROM students WHERE id = ?", [crBothId]);
        assert(crBoth.is_cr === 1 && crBoth.cr_batches === 'Both', "CR Dual properly stored with cr_batches = 'Both'");

        // Step 3: Test Timetable Slot Seeding
        console.log('\n🔹 [Test 3] Setting up Master Timetable Slots for Testing...');
        
        // Clean old test slots
        await db.run("DELETE FROM timetable WHERE subject LIKE 'TEST_%'");
        await db.run("DELETE FROM timetable_overrides WHERE date = '2026-09-07'");
        await db.run("DELETE FROM timetable_override_history WHERE subject LIKE 'TEST_%'");

        // Insert Master Slot 1: Monday 10:00 - 11:00 AM, Room 114, Both batches
        const insertSlot1 = await db.run(`
            INSERT INTO timetable (day, start_time, end_time, subject, teacher, room, batch, division, semester, year, program, academic_year, is_lab, active)
            VALUES ('Monday', '10:00 AM', '11:00 AM', 'TEST_DBMS', 'Dr. Sharma', '114', 'Both', '3CYBER7', '3rd Semester', '2nd Year', 'B.Tech Cyber Security', '2026-27', 0, 1)
        `);
        const testSlot1Id = insertSlot1.id;

        // Insert Master Slot 2: Monday 10:00 - 11:00 AM, Room 301, Batch 1
        const insertSlot2 = await db.run(`
            INSERT INTO timetable (day, start_time, end_time, subject, teacher, room, batch, division, semester, year, program, academic_year, is_lab, active)
            VALUES ('Monday', '10:00 AM', '11:00 AM', 'TEST_OS_LAB', 'Prof. Verma', '301', 'Batch 1', '3CYBER7', '3rd Semester', '2nd Year', 'B.Tech Cyber Security', '2026-27', 1, 1)
        `);
        const testSlot2Id = insertSlot2.id;

        assert(testSlot1Id > 0 && testSlot2Id > 0, "Master timetable test slots inserted successfully");

        // Step 4: CR Batch 1 trying to edit Batch 2 -> MUST BE REJECTED (403 Forbidden)
        console.log('\n🔹 [Test 4] CR Batch 1 Permission Barrier (Attempting to edit Batch 2)...');
        
        let mockReq = {
            user: { id: cr1Id, ug_id: 'TEST_CR1', role: 'STUDENT', is_cr: 1, cr_batches: 'Batch 1', name: 'CR Batch One' },
            body: {
                timetable_id: testSlot1Id,
                batch: 'Batch 2',
                day: 'Monday',
                target_date: '2026-09-07',
                start_time: '10:00 AM',
                end_time: '11:00 AM',
                subject: 'TEST_DBMS',
                teacher: 'Dr. Sharma',
                old_room: '114',
                new_room: '203',
                change_type: 'TODAY'
            }
        };
        let statusCode = 200;
        let responseJson = null;
        let mockRes = {
            status: function(code) { statusCode = code; return this; },
            json: function(data) { responseJson = data; return this; }
        };

        await timetableController.createRoomChangeOverride(mockReq, mockRes);
        assert(statusCode === 403, `Unauthorized batch edit rejected with HTTP 403 (Actual: ${statusCode})`);
        assert(responseJson && responseJson.message && responseJson.message.includes('Batch 1 only'), `Correct error message returned: "${responseJson?.message}"`);

        // Step 5: Dual CR editing Batch 2 Room 114 -> 203 (Temporary / DATE)
        console.log('\n🔹 [Test 5] Dual CR editing Batch 2 Room 114 -> 203 (Temporary)...');
        mockReq = {
            user: { id: crBothId, ug_id: 'TEST_CRBOTH', role: 'STUDENT', is_cr: 1, cr_batches: 'Both', name: 'CR Dual Batch' },
            body: {
                timetable_id: testSlot1Id,
                batch: 'Batch 2',
                day: 'Monday',
                date: '2026-09-07',
                start_time: '10:00 AM',
                end_time: '11:00 AM',
                subject: 'TEST_DBMS',
                teacher: 'Dr. Sharma',
                old_room: '114',
                new_room: '203',
                change_type: 'DATE'
            }
        };
        statusCode = 200;
        responseJson = null;
        await timetableController.createRoomChangeOverride(mockReq, mockRes);
        assert(statusCode === 200, `Dual CR room change succeeded with HTTP 200 (Actual: ${statusCode})`);
        assert(responseJson && responseJson.success === true, `Room change successfully saved: ${responseJson?.message}`);

        // Step 6: Verify Batch Isolation
        console.log('\n🔹 [Test 6] Batch Isolation Check on Target Date (2026-09-07)...');
        
        // Fetch schedule for Student Batch 1
        let reqB1 = {
            user: { id: b1Id, role: 'STUDENT', batch: 'Batch 1', division: '3CYBER7' },
            query: { date: '2026-09-07' }
        };
        let b1Data = null;
        let resMockB1 = {
            status: function(c) { return this; },
            json: function(d) { b1Data = d.data; return this; }
        };
        await timetableController.getStudentTimetable(reqB1, resMockB1);
        const b1Dbms = b1Data ? b1Data.find(s => s.subject === 'TEST_DBMS') : null;
        assert(b1Dbms && b1Dbms.room === '114', `Batch 1 student sees original Room 114 (Actual: ${b1Dbms?.room})`);
        assert(b1Dbms && !b1Dbms.is_room_changed, `Batch 1 student does NOT have room changed flag`);

        // Fetch schedule for Student Batch 2
        let reqB2 = {
            user: { id: b2Id, role: 'STUDENT', batch: 'Batch 2', division: '3CYBER7' },
            query: { date: '2026-09-07' }
        };
        let b2Data = null;
        let resMockB2 = {
            status: function(c) { return this; },
            json: function(d) { b2Data = d.data; return this; }
        };
        await timetableController.getStudentTimetable(reqB2, resMockB2);
        const b2Dbms = b2Data ? b2Data.find(s => s.subject === 'TEST_DBMS') : null;
        assert(b2Dbms && b2Dbms.room === '203', `Batch 2 student sees new Room 203 (Actual: ${b2Dbms?.room})`);
        assert(b2Dbms && b2Dbms.is_room_changed === true, `Batch 2 student HAS is_room_changed = true`);
        assert(b2Dbms && b2Dbms.old_room === '114', `Batch 2 student sees old_room = 114`);

        // Step 7: Conflict Detection
        console.log('\n🔹 [Test 7] Room Conflict Detection (Room 203 already occupied at 10:00 AM)...');
        // Another class attempts to move into Room 203 at the same time on Monday 2026-09-07
        mockReq = {
            user: { id: crBothId, ug_id: 'TEST_CRBOTH', role: 'STUDENT', is_cr: 1, cr_batches: 'Both', name: 'CR Dual Batch' },
            body: {
                timetable_id: testSlot2Id,
                batch: 'Batch 1',
                day: 'Monday',
                date: '2026-09-07',
                start_time: '10:00 AM',
                end_time: '11:00 AM',
                subject: 'TEST_OS_LAB',
                teacher: 'Prof. Verma',
                old_room: '301',
                new_room: '203', // Same room, same time, same date
                change_type: 'DATE'
            }
        };
        statusCode = 200;
        responseJson = null;
        await timetableController.createRoomChangeOverride(mockReq, mockRes);
        assert(statusCode === 409, `Conflict detected and returned HTTP 409 (Actual: ${statusCode})`);
        assert(responseJson && responseJson.conflict === true, `Conflict payload returned properly: "${responseJson?.message}"`);

        // Step 8: Admin Conflict Override
        console.log('\n🔹 [Test 8] Admin Conflict Force Override...');
        mockReq = {
            user: { id: 1, role: 'ADMIN', name: 'Super Admin' },
            body: {
                timetable_id: testSlot2Id,
                batch: 'Batch 1',
                day: 'Monday',
                date: '2026-09-07',
                start_time: '10:00 AM',
                end_time: '11:00 AM',
                subject: 'TEST_OS_LAB',
                teacher: 'Prof. Verma',
                old_room: '301',
                new_room: '203',
                change_type: 'DATE',
                force_override: true
            }
        };
        statusCode = 200;
        responseJson = null;
        await timetableController.createRoomChangeOverride(mockReq, mockRes);
        assert(statusCode === 200, `Admin force override succeeded with HTTP 200 (Actual: ${statusCode})`);

        // Step 9: Automatic Student Notifications Check
        console.log('\n🔹 [Test 9] Notification Dispatch Verification...');
        const notifications = await db.query(`
            SELECT * FROM notifications 
            WHERE message LIKE '%TEST_DBMS%'
            ORDER BY created_at DESC
        `);
        assert(notifications.length > 0, `Notification found in database for TEST_DBMS room change (Count: ${notifications.length})`);
        const notif = notifications[0];
        assert(notif.target_batch === 'Batch 2', `Notification specifically targeted to Batch 2 (Actual: ${notif.target_batch})`);
        assert(notif.message.includes('114') && notif.message.includes('203'), `Notification message contains old room (114) and new room (203)`);

        // Step 10: Change History Audit Trail Check
        console.log('\n🔹 [Test 10] Change History Audit Trail Verification...');
        const historyRows = await db.query(`
            SELECT * FROM timetable_override_history 
            WHERE subject = 'TEST_DBMS'
            ORDER BY created_at DESC
        `);
        assert(historyRows.length > 0, `Change history entry recorded for TEST_DBMS (Count: ${historyRows.length})`);
        const hist = historyRows[0];
        assert(hist.batch === 'Batch 2', `History entry batch is 'Batch 2'`);
        assert(hist.old_room === '114' && hist.new_room === '203', `History entry recorded old_room 114 -> new_room 203`);
        assert(hist.changed_by_role === 'CR' || hist.changed_by_role === 'STUDENT', `History recorded user role (${hist.changed_by_role}) and name (${hist.changed_by_name})`);

        // Step 11: History Access Endpoint Check (Admin & CR)
        console.log('\n🔹 [Test 11] History Access Endpoint Permissions...');
        let reqHist = {
            user: { id: cr1Id, role: 'STUDENT', is_cr: 1, cr_batches: 'Batch 1' },
            query: {}
        };
        let histResData = null;
        let resHist = {
            status: function(c) { return this; },
            json: function(d) { histResData = d.data; return this; }
        };
        await timetableController.getOverrideHistory(reqHist, resHist);
        // CR 1 (Batch 1 only) should NOT see Batch 2 TEST_DBMS history
        const cr1SeesBatch2 = histResData ? histResData.some(h => h.subject === 'TEST_DBMS' && h.batch === 'Batch 2') : false;
        assert(!cr1SeesBatch2, `CR for Batch 1 only CANNOT see Batch 2 change history`);

        // CR Both should see Batch 2 TEST_DBMS history
        reqHist.user = { id: crBothId, role: 'STUDENT', is_cr: 1, cr_batches: 'Both' };
        histResData = null;
        await timetableController.getOverrideHistory(reqHist, resHist);
        const crBothSeesBatch2 = histResData ? histResData.some(h => h.subject === 'TEST_DBMS' && h.batch === 'Batch 2') : false;
        assert(crBothSeesBatch2, `Dual CR (Both) CAN view Batch 2 change history`);

        // Clean up test rows
        await db.run("DELETE FROM timetable WHERE subject LIKE 'TEST_%'");
        await db.run("DELETE FROM timetable_overrides WHERE date = '2026-09-07'");
        await db.run("DELETE FROM timetable_override_history WHERE subject LIKE 'TEST_%'");
        await db.run("DELETE FROM notifications WHERE message LIKE '%TEST_%'");
        await db.run("DELETE FROM students WHERE ug_id LIKE 'TEST_%'");

    } catch (err) {
        console.error('💥 Test suite encountered an unexpected exception:', err);
        failed++;
    }

    console.log('\n=====================================================');
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=====================================================');

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests();
