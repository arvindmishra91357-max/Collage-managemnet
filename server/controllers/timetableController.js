const db = require('../db');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Helper to get current date & time in Indian Standard Time (IST / Asia/Kolkata)
function getIndianDate() {
  try {
    const now = new Date();
    const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    return new Date(istString);
  } catch (e) {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 5.5));
  }
}

// Helper to get current date string in YYYY-MM-DD
function getIndianDateString() {
  const d = getIndianDate();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to get current day name
function getCurrentDay() {
  const date = getIndianDate();
  const dayName = DAYS[date.getDay()];
  return dayName === 'Sunday' ? 'Monday' : dayName; // Default Sunday to Monday schedule preview
}

// Helper to convert time string to absolute minutes from midnight (09:30 -> 570 mins, 01:15 -> 795 mins)
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  let str = timeStr.toString().trim().toUpperCase();
  const isPM = str.includes('PM');
  const isAM = str.includes('AM');
  str = str.replace(/AM|PM/g, '').trim();

  const parts = str.split(':');
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;

  if (isPM && h < 12) {
    h += 12;
  } else if (isAM && h === 12) {
    h = 0;
  } else if (!isAM && !isPM) {
    // If no AM/PM specified, college afternoon hours (01:xx to 07:xx) are PM
    if (h >= 1 && h <= 7) {
      h += 12;
    }
  }
  return h * 60 + m;
}

// SQL ordering clause ensuring morning slots (09:30 AM) always come first
const TIMETABLE_ORDER_BY = `
  ORDER BY 
    CASE day 
      WHEN 'Monday' THEN 1 
      WHEN 'Tuesday' THEN 2 
      WHEN 'Wednesday' THEN 3 
      WHEN 'Thursday' THEN 4 
      WHEN 'Friday' THEN 5 
      WHEN 'Saturday' THEN 6 
      ELSE 7 
    END,
    CASE 
      WHEN start_time LIKE '09:%' OR start_time LIKE '9:%' THEN 1
      WHEN start_time LIKE '10:%' THEN 2
      WHEN start_time LIKE '11:%' THEN 3
      WHEN start_time LIKE '12:%' THEN 4
      WHEN start_time LIKE '01:%' OR start_time LIKE '1:%' THEN 5
      WHEN start_time LIKE '02:%' OR start_time LIKE '2:%' THEN 6
      WHEN start_time LIKE '03:%' OR start_time LIKE '3:%' THEN 7
      WHEN start_time LIKE '04:%' OR start_time LIKE '4:%' THEN 8
      ELSE 9
    END ASC
`;

// Helper: Apply date-specific overrides to timetable slots
async function applyOverridesToSlots(slots, targetDate) {
  if (!slots || slots.length === 0 || !targetDate) return slots;

  try {
    const overrides = await db.query(
      "SELECT * FROM timetable_overrides WHERE date = ? AND status = 'ACTIVE'",
      [targetDate]
    );

    const overrideMap = new Map();
    for (const ov of overrides) {
      overrideMap.set(ov.timetable_id, ov);
    }

    return slots.map(slot => {
      const ov = overrideMap.get(slot.id);
      if (!ov) {
        return {
          ...slot,
          has_room_change: false,
          is_cancelled: false,
          override_id: null
        };
      }

      if (ov.override_type === 'ROOM_CHANGE') {
        return {
          ...slot,
          room: ov.new_room,
          original_room: ov.original_room || slot.room,
          has_room_change: true,
          is_cancelled: false,
          room_change_reason: ov.reason,
          override_changed_by: ov.changed_by_name,
          override_role: ov.changed_by_role,
          override_id: ov.id
        };
      } else if (ov.override_type === 'CANCELLED') {
        return {
          ...slot,
          is_cancelled: true,
          has_room_change: false,
          cancel_reason: ov.reason,
          override_changed_by: ov.changed_by_name,
          override_role: ov.changed_by_role,
          override_id: ov.id
        };
      }

      return {
        ...slot,
        has_room_change: false,
        is_cancelled: false,
        override_id: ov.id
      };
    });
  } catch (err) {
    console.error('[TimetableController] applyOverridesToSlots error:', err);
    return slots;
  }
}

// 1. Get Timetable for Student (Filtered by Batch & Day with date-specific overrides)
async function getStudentTimetable(req, res) {
  try {
    const studentBatch = req.user ? req.user.batch : (req.query.batch || 'Batch 2');
    const { day, date } = req.query;
    const targetDate = date || getIndianDateString();

    let sql = "SELECT * FROM timetable WHERE active = 1 AND (batch = ? OR batch = 'Both')";
    const params = [studentBatch];

    if (day && day !== 'ALL') {
      sql += " AND day = ?";
      params.push(day);
    }

    sql += TIMETABLE_ORDER_BY;

    let rows = await db.query(sql, params);

    // Apply date-specific overrides if date is requested or viewing today's schedule
    if (targetDate) {
      rows = await applyOverridesToSlots(rows, targetDate);
    }

    // Secondary JavaScript sort guarantee
    rows.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

    // Check if targetDate is a declared holiday
    const holiday = await db.get("SELECT * FROM academic_holidays WHERE date = ?", [targetDate]);

    return res.json({
      success: true,
      data: rows,
      studentBatch,
      targetDate,
      isHoliday: !!holiday,
      holidayInfo: holiday || null,
      currentDay: getCurrentDay()
    });
  } catch (err) {
    console.error('[TimetableController] getStudentTimetable error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve timetable.' });
  }
}

// 2. Get Today's Classes & Next Class for Student (Live Overrides + Holiday + Cancellations)
async function getTodayClasses(req, res) {
  try {
    const studentBatch = req.user ? req.user.batch : (req.query.batch || 'Batch 2');
    const istDate = getIndianDate();
    const actualDay = DAYS[istDate.getDay()];
    const todayDateStr = getIndianDateString();
    const targetDate = req.query.date || todayDateStr;

    // Check for declared holiday on targetDate
    const holiday = await db.get("SELECT * FROM academic_holidays WHERE date = ?", [targetDate]);

    // Parse day of requested targetDate
    let targetDay = actualDay;
    if (req.query.day) {
      targetDay = req.query.day;
    } else if (req.query.date) {
      try {
        const dObj = new Date(req.query.date);
        if (!isNaN(dObj.getTime())) {
          targetDay = DAYS[dObj.getDay()];
        }
      } catch (e) {}
    }

    const requestedDay = targetDay === 'Sunday' ? 'Monday' : targetDay;

    const sql = `
      SELECT * FROM timetable
      WHERE active = 1 AND day = ? AND (batch = ? OR batch = 'Both')
      ${TIMETABLE_ORDER_BY}
    `;
    let classes = await db.query(sql, [requestedDay, studentBatch]);

    // Apply active date-specific overrides (Room changes & Cancellations)
    classes = await applyOverridesToSlots(classes, targetDate);

    // Chronological sort ensuring morning slots come first in order
    classes.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

    let currentMinutes;
    if (req.query.client_minutes !== undefined && !isNaN(parseInt(req.query.client_minutes, 10))) {
      currentMinutes = parseInt(req.query.client_minutes, 10);
    } else {
      currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();
    }

    let liveClass = null;
    let nextClass = null;
    let minDiff = Infinity;
    let completedCount = 0;

    const formattedClasses = classes.map(c => {
      const startMin = timeToMinutes(c.start_time);
      const endMin = timeToMinutes(c.end_time);

      let status = 'UPCOMING';
      if (c.is_cancelled) {
        status = 'CANCELLED';
        completedCount++;
      } else if (currentMinutes >= startMin && currentMinutes <= endMin) {
        status = 'LIVE NOW';
        liveClass = c;
      } else if (currentMinutes > endMin) {
        status = 'COMPLETED';
        completedCount++;
      } else if (currentMinutes < startMin) {
        const diff = startMin - currentMinutes;
        if (diff < minDiff) {
          minDiff = diff;
          nextClass = { ...c, startsInMinutes: diff };
        }
      }

      return {
        ...c,
        status,
        startMinutes: startMin,
        endMinutes: endMin
      };
    });

    const isSunday = actualDay === 'Sunday';
    const isHoliday = !!holiday;
    const dayCompleted = !isSunday && !isHoliday && formattedClasses.length > 0 && completedCount === formattedClasses.length;

    return res.json({
      success: true,
      currentDay: requestedDay,
      actualDay,
      targetDate,
      isSunday,
      isHoliday,
      holidayInfo: holiday || null,
      dayCompleted,
      currentMinutes,
      studentBatch,
      classes: formattedClasses,
      liveClass,
      nextClass
    });
  } catch (err) {
    console.error('[TimetableController] getTodayClasses error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve today classes.' });
  }
}

// 3. Admin: Get Full Timetable (All Days, All Batches) with optional Date Overrides
async function getAllTimetable(req, res) {
  try {
    const { date } = req.query;
    const targetDate = date || getIndianDateString();

    const sql = `
      SELECT * FROM timetable
      ${TIMETABLE_ORDER_BY}
    `;
    let rows = await db.query(sql);

    // Apply overrides for targetDate if specified
    if (targetDate) {
      rows = await applyOverridesToSlots(rows, targetDate);
    }

    // Chronological sort by day and then morning to evening
    const dayOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7 };
    rows.sort((a, b) => {
      if (dayOrder[a.day] !== dayOrder[b.day]) {
        return (dayOrder[a.day] || 7) - (dayOrder[b.day] || 7);
      }
      return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
    });

    return res.json({
      success: true,
      targetDate,
      data: rows
    });
  } catch (err) {
    console.error('[TimetableController] getAllTimetable error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve timetable.' });
  }
}

// 4. Admin: Create Timetable Entry (Master Regular Schedule)
async function createTimetableEntry(req, res) {
  try {
    const { day, start_time, end_time, subject, teacher, room, batch, is_lab } = req.body;

    if (!day || !start_time || !end_time || !subject || !room) {
      return res.status(400).json({
        success: false,
        message: 'Day, Start Time, End Time, Subject, and Room are required.'
      });
    }

    const assignedBatch = batch || 'Both';
    const labFlag = is_lab ? 1 : 0;

    const result = await db.run(`
      INSERT INTO timetable (
        day, start_time, end_time, subject, teacher, room, batch, division, semester, year, program, academic_year, is_lab, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, '3CYBER7', '3rd Semester', '2nd Year', 'B.Tech Cyber Security', '2026-27', ?, 1)
    `, [day, start_time, end_time, subject, teacher || '-', room, assignedBatch, labFlag]);

    return res.status(201).json({
      success: true,
      message: 'Timetable entry added successfully.',
      id: result.id
    });
  } catch (err) {
    console.error('[TimetableController] createTimetableEntry error:', err);
    return res.status(500).json({ success: false, message: 'Failed to add timetable entry.' });
  }
}

// 5. Admin: Update Timetable Entry (Permanent master timetable)
async function updateTimetableEntry(req, res) {
  try {
    const { id } = req.params;
    const { day, start_time, end_time, subject, teacher, room, batch, is_lab, active } = req.body;

    const existing = await db.get("SELECT * FROM timetable WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found.' });
    }

    await db.run(`
      UPDATE timetable
      SET day = ?, start_time = ?, end_time = ?, subject = ?, teacher = ?, room = ?, batch = ?, is_lab = ?, active = ?
      WHERE id = ?
    `, [
      day || existing.day,
      start_time || existing.start_time,
      end_time || existing.end_time,
      subject || existing.subject,
      teacher !== undefined ? teacher : existing.teacher,
      room || existing.room,
      batch || existing.batch,
      is_lab !== undefined ? is_lab : existing.is_lab,
      active !== undefined ? active : existing.active,
      id
    ]);

    return res.json({
      success: true,
      message: 'Timetable entry updated successfully. Changes are live for all students.'
    });
  } catch (err) {
    console.error('[TimetableController] updateTimetableEntry error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update timetable entry.' });
  }
}

// 6. Admin: Delete Timetable Entry
async function deleteTimetableEntry(req, res) {
  try {
    const { id } = req.params;
    await db.run("DELETE FROM timetable WHERE id = ?", [id]);
    await db.run("DELETE FROM timetable_overrides WHERE timetable_id = ?", [id]);
    return res.json({ success: true, message: 'Timetable entry deleted successfully.' });
  } catch (err) {
    console.error('[TimetableController] deleteTimetableEntry error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete timetable entry.' });
  }
}

// ==================== 7. MANUAL DATE-SPECIFIC ROOM CHANGE (Admin & Authorized CR) ====================
async function createRoomChangeOverride(req, res) {
  try {
    const { timetable_id, date, new_room, reason } = req.body;

    if (!timetable_id || !date || !new_room || !new_room.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Timetable Slot ID, Target Date, and New Room number are required.'
      });
    }

    const cleanRoom = new_room.trim();
    const cleanReason = (reason || '').trim() || 'Classroom change requested';
    const cleanDate = date.trim();

    // Fetch master timetable slot
    const slot = await db.get("SELECT * FROM timetable WHERE id = ?", [timetable_id]);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Target timetable slot not found.' });
    }

    const user = req.user;
    const isAdmin = user.role === 'ADMIN';

    // Verify CR permissions
    if (!isAdmin) {
      // Check if student is authorized CR
      const student = await db.get("SELECT is_cr, division, name, ug_id FROM students WHERE ug_id = ?", [user.ug_id]);
      if (!student || student.is_cr !== 1) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Only authorized Class Representatives (CR) or Admins can perform temporary room changes.'
        });
      }

      // CR rule 1: Can only change room for their division
      if (slot.division && slot.division !== student.division) {
        return res.status(403).json({
          success: false,
          message: `CR can only change rooms for division ${student.division}.`
        });
      }

      // CR rule 2: Can only change room for today's date
      const todayIST = getIndianDateString();
      if (cleanDate !== todayIST) {
        return res.status(403).json({
          success: false,
          message: 'CR can only submit room changes for today’s active schedule.'
        });
      }

      // CR rule 3: Can only change room for current or upcoming classes (not past classes)
      const istDate = getIndianDate();
      const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();
      const endMinutes = timeToMinutes(slot.end_time);
      if (currentMinutes > endMinutes) {
        return res.status(400).json({
          success: false,
          message: 'Cannot change room for a lecture that has already ended.'
        });
      }
    }

    const changedByRole = isAdmin ? 'ADMIN' : 'CR';
    const changedByName = isAdmin ? (user.username || 'Admin') : (user.name || 'Class Representative');
    const changedByUgId = isAdmin ? null : user.ug_id;

    // Check if an override already exists for this slot on this date
    const existingOverride = await db.get(
      "SELECT id FROM timetable_overrides WHERE timetable_id = ? AND date = ?",
      [timetable_id, cleanDate]
    );

    let overrideId;
    if (existingOverride) {
      await db.run(`
        UPDATE timetable_overrides
        SET override_type = 'ROOM_CHANGE', original_room = ?, new_room = ?, reason = ?, status = 'ACTIVE',
            changed_by_role = ?, changed_by_name = ?, changed_by_ug_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [slot.room, cleanRoom, cleanReason, changedByRole, changedByName, changedByUgId, existingOverride.id]);
      overrideId = existingOverride.id;
    } else {
      const insRes = await db.run(`
        INSERT INTO timetable_overrides (
          timetable_id, date, override_type, original_room, new_room, reason, status, changed_by_role, changed_by_name, changed_by_ug_id
        ) VALUES (?, ?, 'ROOM_CHANGE', ?, ?, ?, 'ACTIVE', ?, ?, ?)
      `, [timetable_id, cleanDate, slot.room, cleanRoom, cleanReason, changedByRole, changedByName, changedByUgId]);
      overrideId = insRes.id;
    }

    // Record audit history
    await db.run(`
      INSERT INTO timetable_override_history (
        timetable_id, date, subject, day, start_time, end_time, action, old_room, new_room, reason, changed_by_role, changed_by_name, changed_by_ug_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'ROOM_CHANGE', ?, ?, ?, ?, ?, ?)
    `, [timetable_id, cleanDate, slot.subject, slot.day, slot.start_time, slot.end_time, slot.room, cleanRoom, cleanReason, changedByRole, changedByName, changedByUgId]);

    // Dispatch in-app student notification
    try {
      const notifTitle = `📢 Room Change: ${slot.subject} → Room ${cleanRoom}`;
      const notifMsg = `${slot.subject} lecture on ${cleanDate} (${slot.start_time}–${slot.end_time}) room has been moved to Room ${cleanRoom} (Regular: ${slot.room}). Reason: ${cleanReason} [Updated by ${changedByName} (${changedByRole})]`;
      const targetType = slot.batch === 'Batch 1' ? 'BATCH_1' : slot.batch === 'Batch 2' ? 'BATCH_2' : 'ALL';
      await db.run(`
        INSERT INTO notifications (title, message, type, target_type, target_batch)
        VALUES (?, ?, 'ALERT', ?, ?)
      `, [notifTitle, notifMsg, targetType, slot.batch !== 'Both' ? slot.batch : null]);
    } catch (notifErr) {
      console.warn('[TimetableController] Notification dispatch failed:', notifErr.message);
    }

    return res.json({
      success: true,
      message: `Room for ${slot.subject} on ${cleanDate} temporarily changed from ${slot.room} to ${cleanRoom}.`,
      override: {
        id: overrideId,
        timetable_id,
        date: cleanDate,
        subject: slot.subject,
        original_room: slot.room,
        new_room: cleanRoom,
        reason: cleanReason,
        changed_by_name: changedByName,
        changed_by_role: changedByRole
      }
    });
  } catch (err) {
    console.error('[TimetableController] createRoomChangeOverride error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record room change.' });
  }
}

// ==================== 8. INDIVIDUAL CLASS CANCELLATION (Admin) ====================
async function cancelClassOverride(req, res) {
  try {
    const { timetable_id, date, reason } = req.body;

    if (!timetable_id || !date) {
      return res.status(400).json({
        success: false,
        message: 'Timetable Slot ID and Target Date are required.'
      });
    }

    const cleanDate = date.trim();
    const cleanReason = (reason || '').trim() || 'Class cancelled by Department';

    const slot = await db.get("SELECT * FROM timetable WHERE id = ?", [timetable_id]);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Target timetable slot not found.' });
    }

    const user = req.user;
    const changedByRole = user.role === 'ADMIN' ? 'ADMIN' : 'CR';
    const changedByName = user.role === 'ADMIN' ? (user.username || 'Admin') : (user.name || 'CR');
    const changedByUgId = user.role === 'ADMIN' ? null : user.ug_id;

    const existingOverride = await db.get(
      "SELECT id FROM timetable_overrides WHERE timetable_id = ? AND date = ?",
      [timetable_id, cleanDate]
    );

    let overrideId;
    if (existingOverride) {
      await db.run(`
        UPDATE timetable_overrides
        SET override_type = 'CANCELLED', original_room = ?, new_room = NULL, reason = ?, status = 'ACTIVE',
            changed_by_role = ?, changed_by_name = ?, changed_by_ug_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [slot.room, cleanReason, changedByRole, changedByName, changedByUgId, existingOverride.id]);
      overrideId = existingOverride.id;
    } else {
      const insRes = await db.run(`
        INSERT INTO timetable_overrides (
          timetable_id, date, override_type, original_room, new_room, reason, status, changed_by_role, changed_by_name, changed_by_ug_id
        ) VALUES (?, ?, 'CANCELLED', ?, NULL, ?, 'ACTIVE', ?, ?, ?)
      `, [timetable_id, cleanDate, slot.room, cleanReason, changedByRole, changedByName, changedByUgId]);
      overrideId = insRes.id;
    }

    // Record audit history
    await db.run(`
      INSERT INTO timetable_override_history (
        timetable_id, date, subject, day, start_time, end_time, action, old_room, new_room, reason, changed_by_role, changed_by_name, changed_by_ug_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'CANCELLED', ?, 'CANCELLED', ?, ?, ?, ?)
    `, [timetable_id, cleanDate, slot.subject, slot.day, slot.start_time, slot.end_time, slot.room, cleanReason, changedByRole, changedByName, changedByUgId]);

    // Dispatch in-app student notification
    try {
      const notifTitle = `⚠️ Class Cancelled: ${slot.subject}`;
      const notifMsg = `${slot.subject} scheduled on ${cleanDate} (${slot.start_time}–${slot.end_time}) has been CANCELLED. Reason: ${cleanReason}`;
      const targetType = slot.batch === 'Batch 1' ? 'BATCH_1' : slot.batch === 'Batch 2' ? 'BATCH_2' : 'ALL';
      await db.run(`
        INSERT INTO notifications (title, message, type, target_type, target_batch)
        VALUES (?, ?, 'ALERT', ?, ?)
      `, [notifTitle, notifMsg, targetType, slot.batch !== 'Both' ? slot.batch : null]);
    } catch (notifErr) {
      console.warn('[TimetableController] Notification dispatch failed:', notifErr.message);
    }

    return res.json({
      success: true,
      message: `${slot.subject} on ${cleanDate} has been marked as CANCELLED.`,
      overrideId
    });
  } catch (err) {
    console.error('[TimetableController] cancelClassOverride error:', err);
    return res.status(500).json({ success: false, message: 'Failed to cancel class.' });
  }
}

// ==================== 9. REVERT OVERRIDE TO REGULAR TIMETABLE ====================
async function revertClassOverride(req, res) {
  try {
    const { id } = req.params; // override id or timetable_id + date

    let override = await db.get("SELECT * FROM timetable_overrides WHERE id = ?", [id]);
    if (!override && req.body.timetable_id && req.body.date) {
      override = await db.get("SELECT * FROM timetable_overrides WHERE timetable_id = ? AND date = ?", [req.body.timetable_id, req.body.date]);
    }

    if (!override) {
      return res.status(404).json({ success: false, message: 'Override record not found.' });
    }

    const slot = await db.get("SELECT * FROM timetable WHERE id = ?", [override.timetable_id]);
    const user = req.user;
    const changedByName = user.role === 'ADMIN' ? (user.username || 'Admin') : (user.name || 'CR');
    const changedByRole = user.role;

    // Delete or mark reverted
    await db.run("DELETE FROM timetable_overrides WHERE id = ?", [override.id]);

    // Record audit history
    if (slot) {
      await db.run(`
        INSERT INTO timetable_override_history (
          timetable_id, date, subject, day, start_time, end_time, action, old_room, new_room, reason, changed_by_role, changed_by_name, changed_by_ug_id
        ) VALUES (?, ?, ?, ?, ?, ?, 'REVERTED', ?, ?, 'Reverted to regular master timetable', ?, ?, ?)
      `, [slot.id, override.date, slot.subject, slot.day, slot.start_time, slot.end_time, override.new_room || 'CANCELLED', slot.room, changedByRole, changedByName, user.ug_id || null]);
    }

    return res.json({
      success: true,
      message: `Temporary override removed. Schedule reverted to regular timetable (${slot ? slot.room : 'Regular'}).`
    });
  } catch (err) {
    console.error('[TimetableController] revertClassOverride error:', err);
    return res.status(500).json({ success: false, message: 'Failed to revert override.' });
  }
}

// ==================== 10. GET ROOM CHANGE & OVERRIDE HISTORY LOG ====================
async function getOverrideHistory(req, res) {
  try {
    const { date, limit = 100 } = req.query;
    let sql = "SELECT * FROM timetable_override_history WHERE 1=1";
    const params = [];

    if (date) {
      sql += " AND date = ?";
      params.push(date);
    }

    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(parseInt(limit, 10) || 100);

    const history = await db.query(sql, params);

    return res.json({
      success: true,
      data: history
    });
  } catch (err) {
    console.error('[TimetableController] getOverrideHistory error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load override history.' });
  }
}

// ==================== 11. GET ACTIVE OVERRIDES FOR A DATE ====================
async function getOverridesForDate(req, res) {
  try {
    const date = req.query.date || getIndianDateString();
    const overrides = await db.query(`
      SELECT o.*, t.subject, t.start_time, t.end_time, t.day, t.teacher, t.batch, t.is_lab
      FROM timetable_overrides o
      JOIN timetable t ON o.timetable_id = t.id
      WHERE o.date = ? AND o.status = 'ACTIVE'
      ORDER BY t.start_time ASC
    `, [date]);

    return res.json({
      success: true,
      date,
      data: overrides
    });
  } catch (err) {
    console.error('[TimetableController] getOverridesForDate error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve date overrides.' });
  }
}

// ==================== 12. ACADEMIC HOLIDAYS & LEAVES ====================
async function addHoliday(req, res) {
  try {
    const { date, title, description } = req.body;

    if (!date || !title) {
      return res.status(400).json({
        success: false,
        message: 'Holiday Date and Title are required.'
      });
    }

    const cleanDate = date.trim();
    const cleanTitle = title.trim();
    const cleanDesc = (description || '').trim();

    const existing = await db.get("SELECT id FROM academic_holidays WHERE date = ?", [cleanDate]);
    if (existing) {
      await db.run("UPDATE academic_holidays SET title = ?, description = ? WHERE id = ?", [cleanTitle, cleanDesc, existing.id]);
    } else {
      await db.run(
        "INSERT INTO academic_holidays (date, title, description, declared_by) VALUES (?, ?, ?, 'Admin')",
        [cleanDate, cleanTitle, cleanDesc]
      );
    }

    // Dispatch Announcement / Notification
    try {
      await db.run(`
        INSERT INTO notifications (title, message, type, target_type)
        VALUES (?, ?, 'ALERT', 'ALL')
      `, [`🌴 Holiday Declared: ${cleanTitle}`, `College / Department Holiday declared for ${cleanDate}: ${cleanTitle}. ${cleanDesc}`]);
    } catch (e) {}

    return res.json({
      success: true,
      message: `Holiday '${cleanTitle}' for ${cleanDate} declared successfully.`
    });
  } catch (err) {
    console.error('[TimetableController] addHoliday error:', err);
    return res.status(500).json({ success: false, message: 'Failed to declare holiday.' });
  }
}

async function getHolidays(req, res) {
  try {
    const holidays = await db.query("SELECT * FROM academic_holidays ORDER BY date ASC");
    return res.json({ success: true, data: holidays });
  } catch (err) {
    console.error('[TimetableController] getHolidays error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load holidays.' });
  }
}

async function deleteHoliday(req, res) {
  try {
    const { id } = req.params;
    await db.run("DELETE FROM academic_holidays WHERE id = ? OR date = ?", [id, id]);
    return res.json({ success: true, message: 'Holiday deleted successfully.' });
  } catch (err) {
    console.error('[TimetableController] deleteHoliday error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete holiday.' });
  }
}

module.exports = {
  getStudentTimetable,
  getTodayClasses,
  getAllTimetable,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  createRoomChangeOverride,
  cancelClassOverride,
  revertClassOverride,
  getOverrideHistory,
  getOverridesForDate,
  addHoliday,
  getHolidays,
  deleteHoliday
};
