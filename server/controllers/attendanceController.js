const crypto = require('crypto');
const QRCode = require('qrcode');
const db = require('../db');

// Server-side Haversine Distance Formula (calculates distance in meters between two GPS coordinates)
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of Earth in meters
  const toRad = deg => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Generate secure dynamic token for a session
function generateDynamicToken(sessionId, secret, intervalSeconds = 15) {
  const timeBlock = Math.floor(Date.now() / (intervalSeconds * 1000));
  const data = `${sessionId}:${secret}:${timeBlock}`;
  const hash = crypto.createHmac('sha256', secret).update(data).digest('hex').substring(0, 16);
  return `${sessionId}_${timeBlock}_${hash}`;
}

// Verify dynamic token (allows current block or immediate previous block for network tolerance)
function verifyDynamicToken(tokenString, secret, intervalSeconds = 15) {
  if (!tokenString) return { valid: false };
  const parts = tokenString.split('_');
  if (parts.length !== 3) return { valid: false };

  const [sessionId, tokenTimeBlock, hash] = parts;
  const currentTimeBlock = Math.floor(Date.now() / (intervalSeconds * 1000));
  const parsedTimeBlock = parseInt(tokenTimeBlock, 10);

  // Accept token if generated in the last 2 intervals (e.g. ~30s max tolerance)
  if (Math.abs(currentTimeBlock - parsedTimeBlock) > 2) {
    return { valid: false, reason: 'QR Code expired. Please scan the newly refreshed QR.' };
  }

  const expectedData = `${sessionId}:${secret}:${parsedTimeBlock}`;
  const expectedHash = crypto.createHmac('sha256', secret).update(expectedData).digest('hex').substring(0, 16);

  if (hash !== expectedHash) {
    return { valid: false, reason: 'Invalid QR token verification.' };
  }

  return { valid: true, sessionId: parseInt(sessionId, 10) };
}

// 1. Admin: Start Dynamic QR Attendance Session
async function startQRSession(req, res) {
  try {
    const { subject, batch, classroom_lat, classroom_lng, allowed_radius_meters, qr_refresh_interval, duration_minutes = 30 } = req.body;

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Subject for the attendance session.'
      });
    }

    const assignedBatch = batch || 'Both';
    const lat = classroom_lat !== undefined ? parseFloat(classroom_lat) : 22.2887;
    const lng = classroom_lng !== undefined ? parseFloat(classroom_lng) : 73.3634;
    const radius = parseFloat(allowed_radius_meters) || 5000.0;
    const refreshSec = parseInt(qr_refresh_interval, 10) || 15;

    const dateStr = new Date().toISOString().split('T')[0];
    const startTime = new Date();
    const expiryTime = new Date(startTime.getTime() + (duration_minutes * 60 * 1000));
    const sessionSecret = crypto.randomBytes(16).toString('hex');

    const result = await db.run(`
      INSERT INTO attendance_sessions (
        date, subject, division, batch, start_time, expiry_time, session_token,
        classroom_lat, classroom_lng, allowed_radius_meters, qr_refresh_interval, status, created_by
      ) VALUES (?, ?, '3CYBER7', ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'Admin')
    `, [dateStr, subject, assignedBatch, startTime.toISOString(), expiryTime.toISOString(), sessionSecret, lat, lng, radius, refreshSec]);

    const sessionId = result.id;
    const initialToken = generateDynamicToken(sessionId, sessionSecret, refreshSec);
    let initialQrImage = '';
    try {
      initialQrImage = await QRCode.toDataURL(initialToken, {
        width: 320,
        margin: 1,
        color: { dark: '#090d16', light: '#ffffff' }
      });
    } catch (qrErr) {
      console.error('[AttendanceController] QR gen error:', qrErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Dynamic QR Attendance session started successfully.',
      session: {
        id: sessionId,
        subject,
        batch: assignedBatch,
        date: dateStr,
        classroom_lat: lat,
        classroom_lng: lng,
        allowed_radius_meters: radius,
        qr_refresh_interval: refreshSec,
        expiry_time: expiryTime.toISOString(),
        initial_token: initialToken,
        initial_qr_image: initialQrImage
      }
    });
  } catch (err) {
    console.error('[AttendanceController] startQRSession error:', err);
    return res.status(500).json({ success: false, message: 'Failed to start QR session.' });
  }
}

// 2. Admin: Get Live Rotating QR Token for an Active Session
async function getLiveQRToken(req, res) {
  try {
    const { id } = req.params;
    const session = await db.get("SELECT * FROM attendance_sessions WHERE id = ?", [id]);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Attendance session not found.' });
    }

    if (session.status !== 'ACTIVE' || new Date(session.expiry_time) < new Date()) {
      return res.json({
        success: false,
        status: 'EXPIRED',
        message: 'This attendance session has ended.'
      });
    }

    const token = generateDynamicToken(session.id, session.session_token, session.qr_refresh_interval || 15);
    let qrImage = '';
    try {
      qrImage = await QRCode.toDataURL(token, {
        width: 320,
        margin: 1,
        color: { dark: '#090d16', light: '#ffffff' }
      });
    } catch (qrErr) {
      console.error('[AttendanceController] QR gen error:', qrErr);
    }

    const scannedCount = await db.get("SELECT COUNT(*) as count FROM attendance_records WHERE session_id = ?", [session.id]);

    return res.json({
      success: true,
      token,
      qr_image: qrImage,
      sessionId: session.id,
      subject: session.subject,
      batch: session.batch,
      refreshInterval: session.qr_refresh_interval || 15,
      scannedCount: scannedCount ? scannedCount.count : 0,
      expiryTime: session.expiry_time
    });
  } catch (err) {
    console.error('[AttendanceController] getLiveQRToken error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate live QR token.' });
  }
}

// 3. Student: Scan Dynamic QR (Instant Verification)
async function markQRScan(req, res) {
  try {
    const { token, student_lat, student_lng, accuracy } = req.body;
    const ugId = req.user.ug_id;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Missing QR attendance token.' });
    }

    // 1. Get Student details
    const student = await db.get("SELECT * FROM students WHERE ug_id = ?", [ugId]);
    if (!student || student.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Student account is not authorized or active.' });
    }

    // Extract Session ID from token prefix
    const tokenParts = token.split('_');
    const sessionId = parseInt(tokenParts[0], 10);
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Invalid QR token structure.' });
    }

    // 2. Fetch Session
    const session = await db.get("SELECT * FROM attendance_sessions WHERE id = ?", [sessionId]);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Attendance session not found.' });
    }

    if (session.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'This attendance session is no longer active.' });
    }

    if (new Date() > new Date(session.expiry_time)) {
      return res.status(400).json({ success: false, message: 'This attendance session has expired.' });
    }

    // 3. Validate Dynamic QR Token Freshness (Prevents stale QR codes)
    const verification = verifyDynamicToken(token, session.session_token, session.qr_refresh_interval || 15);
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: verification.reason || 'QR Code has expired. Please scan the current live QR on the classroom screen.'
      });
    }

    // 4. Batch Validation
    if (session.batch !== 'Both' && session.batch !== student.batch) {
      return res.status(403).json({
        success: false,
        message: `This attendance session is designated for ${session.batch}. Your assigned batch is ${student.batch}.`
      });
    }

    // 5. Check Duplicate Attendance (One attendance per student per session)
    const alreadyMarked = await db.get("SELECT id, marked_at FROM attendance_records WHERE session_id = ? AND ug_id = ?", [sessionId, ugId]);
    if (alreadyMarked) {
      return res.status(409).json({
        success: false,
        message: 'You have already marked attendance for this session.'
      });
    }

    // 6. Record Attendance (Location geofencing check removed as requested)
    const sLat = student_lat !== undefined ? parseFloat(student_lat) : 0;
    const sLng = student_lng !== undefined ? parseFloat(student_lng) : 0;

    await db.run(`
      INSERT INTO attendance_records (
        session_id, ug_id, student_name, roll_number, batch, subject, date, status, method, verified_distance_meters, student_lat, student_lng
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PRESENT', 'QR_SCAN', 0, ?, ?)
    `, [
      sessionId, ugId, student.name, student.roll_number, student.batch,
      session.subject, session.date, sLat, sLng
    ]);

    // Also update aggregated logs table for marksheets and student stats
    await db.run(`
      INSERT OR REPLACE INTO attendance_manual (ug_id, student_name, date, subject, batch, status, remarks, marked_by)
      VALUES (?, ?, ?, ?, ?, 'PRESENT', 'Verified via Live Classroom QR Scan', 'QR_SYSTEM')
    `, [ugId, student.name, session.date, session.subject, student.batch]);

    return res.json({
      success: true,
      message: `✓ Attendance Verified & Marked PRESENT for ${session.subject}!`,
      session: {
        subject: session.subject,
        batch: student.batch,
        date: session.date
      }
    });
  } catch (err) {
    console.error('[AttendanceController] markQRScan error:', err);
    return res.status(500).json({ success: false, message: 'Server error while verifying attendance.' });
  }
}

// 4. Admin: Stop Active Session
async function stopQRSession(req, res) {
  try {
    const { id } = req.params;
    await db.run("UPDATE attendance_sessions SET status = 'STOPPED' WHERE id = ?", [id]);
    return res.json({ success: true, message: 'Attendance session stopped.' });
  } catch (err) {
    console.error('[AttendanceController] stopQRSession error:', err);
    return res.status(500).json({ success: false, message: 'Failed to stop session.' });
  }
}

// 5. Admin: Get Session Details & Live Scan Roster
async function getSessionScans(req, res) {
  try {
    const { id } = req.params;
    const session = await db.get("SELECT * FROM attendance_sessions WHERE id = ?", [id]);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    const scans = await db.query("SELECT * FROM attendance_records WHERE session_id = ? ORDER BY marked_at DESC", [id]);

    return res.json({
      success: true,
      session,
      scans,
      totalScans: scans.length
    });
  } catch (err) {
    console.error('[AttendanceController] getSessionScans error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get session scans.' });
  }
}

// 6. Admin: Save Manual Attendance with Audit Logging (Requirement #29, #42)
async function saveManualAttendance(req, res) {
  try {
    const { date, subject, batch, records } = req.body;
    // records is an array of { ug_id, student_name, status, remarks }

    if (!date || !subject || !records || !Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        message: 'Date, Subject, and Student records list are required.'
      });
    }

    const assignedBatch = batch || 'Both';

    for (const rec of records) {
      const existing = await db.get(
        "SELECT * FROM attendance_manual WHERE ug_id = ? AND date = ? AND subject = ?",
        [rec.ug_id, date, subject]
      );

      const oldStatus = existing ? existing.status : null;
      const newStatus = rec.status || 'PRESENT';

      if (existing) {
        await db.run(`
          UPDATE attendance_manual
          SET status = ?, remarks = ?, marked_by = 'Admin'
          WHERE id = ?
        `, [newStatus, rec.remarks || 'Manual Admin Entry', existing.id]);
      } else {
        await db.run(`
          INSERT INTO attendance_manual (ug_id, student_name, date, subject, batch, status, remarks, marked_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'Admin')
        `, [rec.ug_id, rec.student_name, date, subject, assignedBatch, newStatus, rec.remarks || 'Manual Admin Entry']);
      }

      // Log to Audit Log if status changed or created manually
      if (oldStatus !== newStatus) {
        await db.run(`
          INSERT INTO attendance_audit_logs (action, ug_id, old_status, new_status, changed_by, reason)
          VALUES ('MANUAL_OVERRIDE', ?, ?, ?, 'Admin', ?)
        `, [rec.ug_id, oldStatus || 'UNRECORDED', newStatus, rec.remarks || 'Admin manual update']);
      }
    }

    return res.json({
      success: true,
      message: `Manual attendance saved for ${records.length} students on ${date} (${subject}).`
    });
  } catch (err) {
    console.error('[AttendanceController] saveManualAttendance error:', err);
    return res.status(500).json({ success: false, message: 'Failed to save manual attendance.' });
  }
}

// 7. Student: Get Own Attendance Summary & Subject Breakdown (Requirement #43)
async function getStudentAttendance(req, res) {
  try {
    const ugId = req.user.ug_id;

    // Get all records from manual & QR logs for this student
    const records = await db.query(`
      SELECT date, subject, status, 'QR Scan Verified' as remarks, 'QR_GPS' as method, marked_at as timestamp
      FROM attendance_records
      WHERE ug_id = ?
      UNION ALL
      SELECT date, subject, status, remarks, 'MANUAL' as method, created_at as timestamp
      FROM attendance_manual
      WHERE ug_id = ? AND ug_id NOT IN (
        SELECT ug_id FROM attendance_records WHERE date = attendance_manual.date AND subject = attendance_manual.subject
      )
      ORDER BY date DESC
    `, [ugId, ugId]);

    const totalLectures = records.length;
    const presentCount = records.filter(r => r.status === 'PRESENT').length;
    const absentCount = records.filter(r => r.status === 'ABSENT').length;
    const leaveCount = records.filter(r => r.status === 'LEAVE').length;

    const overallPercentage = totalLectures > 0 ? ((presentCount / totalLectures) * 100).toFixed(1) : '100.0';

    // Subject-wise grouping
    const subjectMap = {};
    records.forEach(r => {
      if (!subjectMap[r.subject]) {
        subjectMap[r.subject] = { subject: r.subject, total: 0, present: 0, absent: 0 };
      }
      subjectMap[r.subject].total++;
      if (r.status === 'PRESENT') subjectMap[r.subject].present++;
      if (r.status === 'ABSENT') subjectMap[r.subject].absent++;
    });

    const subjectBreakdown = Object.values(subjectMap).map(s => ({
      subject: s.subject,
      total: s.total,
      present: s.present,
      absent: s.absent,
      percentage: ((s.present / s.total) * 100).toFixed(1)
    }));

    return res.json({
      success: true,
      stats: {
        total: totalLectures,
        present: presentCount,
        absent: absentCount,
        leave: leaveCount,
        percentage: overallPercentage
      },
      subjectBreakdown,
      history: records
    });
  } catch (err) {
    console.error('[AttendanceController] getStudentAttendance error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve attendance summary.' });
  }
}

// 8. Admin: Attendance Analytics & Reports (Daily, Monthly, Subject-wise, CSV Export)
async function getAdminAttendanceReport(req, res) {
  try {
    const { date, subject, batch } = req.query;

    let sql = `
      SELECT am.id, am.ug_id, s.name as student_name, s.roll_number, s.batch, am.date, am.subject, am.status, am.remarks, am.marked_by, am.created_at
      FROM attendance_manual am
      JOIN students s ON am.ug_id = s.ug_id
      WHERE 1=1
    `;
    const params = [];

    if (date) {
      sql += " AND am.date = ?";
      params.push(date);
    }
    if (subject && subject !== 'ALL') {
      sql += " AND am.subject = ?";
      params.push(subject);
    }
    if (batch && (batch === 'Batch 1' || batch === 'Batch 2')) {
      sql += " AND s.batch = ?";
      params.push(batch);
    }

    sql += " ORDER BY am.date DESC, s.roll_number ASC";

    const rows = await db.query(sql, params);

    // Also get active sessions list
    const sessions = await db.query("SELECT * FROM attendance_sessions ORDER BY start_time DESC LIMIT 20");

    // Audit logs
    const auditLogs = await db.query("SELECT * FROM attendance_audit_logs ORDER BY created_at DESC LIMIT 50");

    return res.json({
      success: true,
      records: rows,
      sessions,
      auditLogs,
      count: rows.length
    });
  } catch (err) {
    console.error('[AttendanceController] getAdminAttendanceReport error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate attendance report.' });
  }
}

module.exports = {
  startQRSession,
  getLiveQRToken,
  markQRScan,
  stopQRSession,
  getSessionScans,
  saveManualAttendance,
  getStudentAttendance,
  getAdminAttendanceReport
};
