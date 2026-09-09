const db = require('../db');
const realtime = require('../realtime');

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

// Room Conflict Detection Helper
async function checkRoomConflict({ room, date, day, start_time, end_time, excludeTimetableId, batch }) {
  if (!room || !start_time || !end_time) return { hasConflict: false };
  const startMin = timeToMinutes(start_time);
  const endMin = timeToMinutes(end_time);

  // 1. Check master regular schedule for this day and room
  const masterSlots = await db.query(
    "SELECT * FROM timetable WHERE active = 1 AND day = ? AND UPPER(TRIM(room)) = UPPER(TRIM(?))",
    [day, room.trim()]
  );

  for (const ms of masterSlots) {
    if (excludeTimetableId && ms.id === parseInt(excludeTimetableId, 10)) continue;

    const msStart = timeToMinutes(ms.start_time);
    const msEnd = timeToMinutes(ms.end_time);

    // Overlap condition: startMin < msEnd && endMin > msStart
    if (startMin < msEnd && endMin > msStart) {
      // Check if this conflicting master slot was moved out of this room or cancelled on this specific date
      if (date) {
        const slotOv = await db.get(
          "SELECT * FROM timetable_overrides WHERE timetable_id = ? AND date = ? AND status = 'ACTIVE'",
          [ms.id, date]
        );
        if (slotOv && (slotOv.override_type === 'CANCELLED' || (slotOv.override_type === 'ROOM_CHANGE' && (slotOv.new_room || '').toUpperCase().trim() !== room.toUpperCase().trim()))) {
          continue; // Slot vacated the room on this date
        }
      }
      return {
        hasConflict: true,
        conflictSlot: ms,
        details: `Room ${room} is already assigned to ${ms.subject} (${ms.batch || 'Both'}) from ${ms.start_time} to ${ms.end_time} on ${day}.`
      };
    }
  }

  // 2. Check date-specific overrides moving other classes into this room on this date
  if (date) {
    const dateOverrides = await db.query(`
      SELECT o.*, t.subject, t.start_time, t.end_time, t.day, t.batch AS original_batch
      FROM timetable_overrides o
      JOIN timetable t ON o.timetable_id = t.id
      WHERE o.date = ? AND o.status = 'ACTIVE' AND o.override_type = 'ROOM_CHANGE' AND UPPER(TRIM(o.new_room)) = UPPER(TRIM(?))
    `, [date, room.trim()]);

    for (const ov of dateOverrides) {
      if (excludeTimetableId && ov.timetable_id === parseInt(excludeTimetableId, 10)) continue;
      const ovStart = timeToMinutes(ov.new_start_time || ov.start_time);
      const ovEnd = timeToMinutes(ov.new_end_time || ov.end_time);

      if (startMin < ovEnd && endMin > ovStart) {
        return {
          hasConflict: true,
          conflictSlot: ov,
          details: `Room ${room} is already booked by temporary override for ${ov.new_subject || ov.subject} (${ov.batch || ov.original_batch || 'Both'}) from ${ov.new_start_time || ov.start_time} to ${ov.new_end_time || ov.end_time} on ${date}.`
        };
      }
    }
  }

  return { hasConflict: false };
}

// Helper: Apply date-specific overrides to timetable slots with Batch Isolation
async function applyOverridesToSlots(slots, targetDate, studentBatch) {
  if (!slots || slots.length === 0 || !targetDate) return slots;

  try {
    const overrides = await db.query(
      "SELECT * FROM timetable_overrides WHERE date = ? AND status = 'ACTIVE'",
      [targetDate]
    );

    // Filter overrides applicable to student's batch
    const overrideMap = new Map();
    for (const ov of overrides) {
      if (studentBatch && ov.batch && ov.batch !== 'Both' && ov.batch !== studentBatch) {
        // Skip override if it belongs strictly to another batch
        continue;
      }
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
          old_room: ov.original_room || slot.room,
          subject: ov.new_subject || slot.subject,
          teacher: ov.new_teacher !== undefined && ov.new_teacher !== null ? ov.new_teacher : slot.teacher,
          start_time: ov.new_start_time || slot.start_time,
          end_time: ov.new_end_time || slot.end_time,
          has_room_change: true,
          is_room_changed: true,
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

    if (day === 'Sunday') {
      return res.json({
        success: true,
        data: [],
        studentBatch,
        targetDate,
        isSunday: true,
        isHoliday: false,
        holidayInfo: null,
        currentDay: 'Sunday'
      });
    }

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
      rows = await applyOverridesToSlots(rows, targetDate, studentBatch);
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
      currentDay: day || getCurrentDay()
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

    let currentMinutes;
    if (req.query.client_minutes !== undefined && !isNaN(parseInt(req.query.client_minutes, 10))) {
      currentMinutes = parseInt(req.query.client_minutes, 10);
    } else {
      currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();
    }

    const isSunday = targetDay === 'Sunday';
    const isHoliday = !!holiday;

    // If it's Sunday or a declared holiday, return empty classes list with holiday metadata
    if (isSunday || isHoliday) {
      return res.json({
        success: true,
        currentDay: targetDay,
        actualDay,
        targetDate,
        isSunday,
        isHoliday,
        holidayInfo: holiday || null,
        dayCompleted: false,
        currentMinutes,
        studentBatch,
        classes: [],
        liveClass: null,
        nextClass: null
      });
    }

    const sql = `
      SELECT * FROM timetable
      WHERE active = 1 AND day = ? AND (batch = ? OR batch = 'Both')
      ${TIMETABLE_ORDER_BY}
    `;
    let classes = await db.query(sql, [targetDay, studentBatch]);

    // Apply active date-specific overrides (Room changes & Cancellations)
    classes = await applyOverridesToSlots(classes, targetDate, studentBatch);

    // Chronological sort ensuring morning slots come first in order
    classes.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

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

    const dayCompleted = formattedClasses.length > 0 && completedCount === formattedClasses.length;

    return res.json({
      success: true,
      currentDay: targetDay,
      actualDay,
      targetDate,
      isSunday: false,
      isHoliday: false,
      holidayInfo: null,
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
    const { date, batch } = req.query;
    const targetDate = date || getIndianDateString();

    let sql = `
      SELECT * FROM timetable
      WHERE active = 1
    `;
    const params = [];
    if (batch && (batch === 'Batch 1' || batch === 'Batch 2')) {
      sql += ` AND (batch = ? OR batch = 'Both')`;
      params.push(batch);
    }
    sql += TIMETABLE_ORDER_BY;

    let rows = await db.query(sql, params);

    // Apply overrides for targetDate if specified
    if (targetDate) {
      rows = await applyOverridesToSlots(rows, targetDate, batch);
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
    const {
      timetable_id,
      date,
      target_date,
      new_room,
      reason,
      batch,
      change_type = 'TODAY',
      new_start_time,
      new_end_time,
      new_subject,
      new_teacher,
      override_conflict,
      force_override
    } = req.body;

    const effectiveDate = date || target_date;
    const canForceOverride = override_conflict === true || force_override === true;

    if (!timetable_id || !new_room || !new_room.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Timetable Slot ID and New Room number are required.'
      });
    }

    const cleanRoom = new_room.trim();
    const cleanReason = (reason || '').trim() || 'Classroom change requested';
    const changeType = (change_type || 'TODAY').toUpperCase(); // 'TODAY' | 'DATE' | 'PERMANENT'

    // Fetch master timetable slot
    const slot = await db.get("SELECT * FROM timetable WHERE id = ?", [timetable_id]);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Target timetable slot not found.' });
    }

    const user = req.user;
    const isAdmin = user.role === 'ADMIN';

    // Target batch resolution
    let targetBatch = batch || slot.batch || 'Both';

    // Verify CR permissions
    if (!isAdmin) {
      // Check if student is authorized CR
      const student = await db.get(
        "SELECT is_cr, cr_batches, batch, division, name, ug_id FROM students WHERE ug_id = ? OR id = ?",
        [user.ug_id || '', user.id || 0]
      );
      if (!student || student.is_cr !== 1) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Only authorized Class Representatives (CR) or Admins can perform room changes.'
        });
      }

      // CR rule 1: Can only change room for their division
      if (slot.division && slot.division !== student.division) {
        return res.status(403).json({
          success: false,
          message: `CR can only change rooms for division ${student.division}.`
        });
      }

      // CR rule 2: Strict Batch Permissions Verification
      const crBatches = student.cr_batches || student.batch || 'Both';
      if (crBatches === 'Batch 1') {
        if (targetBatch === 'Batch 2' || targetBatch === 'Both') {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You are designated as CR for Batch 1 only and cannot modify Batch 2 schedule.'
          });
        }
        targetBatch = 'Batch 1';
      } else if (crBatches === 'Batch 2') {
        if (targetBatch === 'Batch 1' || targetBatch === 'Both') {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You are designated as CR for Batch 2 only and cannot modify Batch 1 schedule.'
          });
        }
        targetBatch = 'Batch 2';
      } else if (crBatches === 'Both') {
        // Dual CR: Allowed to manage Batch 1, Batch 2, or Both independently!
        if (!batch) {
          targetBatch = slot.batch || 'Both';
        }
      }
    }

    // Determine target date and day
    let cleanDate = (effectiveDate || '').trim();
    let targetDay = slot.day;

    if (changeType === 'TODAY') {
      cleanDate = getIndianDateString();
      const istDate = getIndianDate();
      targetDay = DAYS[istDate.getDay()];
    } else if (changeType === 'DATE') {
      if (!cleanDate) {
        cleanDate = getIndianDateString();
      }
      try {
        const dObj = new Date(cleanDate + 'T00:00:00');
        if (!isNaN(dObj.getTime())) {
          targetDay = DAYS[dObj.getDay()];
        }
      } catch (e) {}
    } else if (changeType === 'PERMANENT') {
      cleanDate = cleanDate || getIndianDateString();
      targetDay = slot.day;
    }

    const finalStartTime = new_start_time || slot.start_time;
    const finalEndTime = new_end_time || slot.end_time;
    const finalSubject = new_subject || slot.subject;
    const finalTeacher = new_teacher !== undefined && new_teacher !== null && new_teacher !== '' ? new_teacher : slot.teacher;

    // ==================== ROOM CONFLICT DETECTION ====================
    const conflict = await checkRoomConflict({
      room: cleanRoom,
      date: changeType === 'PERMANENT' ? null : cleanDate,
      day: targetDay,
      start_time: finalStartTime,
      end_time: finalEndTime,
      excludeTimetableId: slot.id,
      batch: targetBatch
    });

    if (conflict.hasConflict) {
      if (!(isAdmin && canForceOverride)) {
        return res.status(409).json({
          success: false,
          conflict: true,
          message: `⚠️ Room Conflict: ${conflict.details}`,
          conflictDetails: conflict.details
        });
      }
    }

    const changedByRole = isAdmin ? 'ADMIN' : 'CR';
    const changedByName = isAdmin ? (user.username || 'Admin') : (user.name || 'Class Representative');
    const changedByUgId = isAdmin ? null : user.ug_id;

    let overrideId = null;

    if (changeType === 'PERMANENT') {
      // ==================== PERMANENT TIMETABLE CHANGE ====================
      if (slot.batch === 'Both' && (targetBatch === 'Batch 1' || targetBatch === 'Batch 2')) {
        // Dual Batch Isolation on Permanent Change:
        // Split the row so the other batch remains untouched with original room & schedule!
        const otherBatch = targetBatch === 'Batch 1' ? 'Batch 2' : 'Batch 1';
        await db.run("UPDATE timetable SET batch = ? WHERE id = ?", [otherBatch, slot.id]);

        const insRes = await db.run(`
          INSERT INTO timetable (
            day, start_time, end_time, subject, teacher, room, batch, division, semester, year, program, academic_year, is_lab, active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
          slot.day,
          finalStartTime,
          finalEndTime,
          finalSubject,
          finalTeacher,
          cleanRoom,
          targetBatch,
          slot.division || '3CYBER7',
          slot.semester || '3rd Semester',
          slot.year || '2nd Year',
          slot.program || 'B.Tech Cyber Security',
          slot.academic_year || '2026-27',
          slot.is_lab || 0
        ]);
        overrideId = insRes.id;
      } else {
        // Update the existing row directly
        await db.run(`
          UPDATE timetable
          SET room = ?, teacher = ?, subject = ?, start_time = ?, end_time = ?, batch = ?
          WHERE id = ?
        `, [cleanRoom, finalTeacher, finalSubject, finalStartTime, finalEndTime, targetBatch, slot.id]);
        overrideId = slot.id;
      }

      // Record audit history
      await db.run(`
        INSERT INTO timetable_override_history (
          timetable_id, date, subject, day, start_time, end_time, action, old_room, new_room, reason, batch, changed_by_role, changed_by_name, changed_by_ug_id
        ) VALUES (?, ?, ?, ?, ?, ?, 'PERMANENT_CHANGE', ?, ?, ?, ?, ?, ?, ?)
      `, [
        slot.id,
        cleanDate,
        finalSubject,
        slot.day,
        finalStartTime,
        finalEndTime,
        slot.room,
        cleanRoom,
        cleanReason,
        targetBatch,
        changedByRole,
        changedByName,
        changedByUgId
      ]);

    } else {
      // ==================== DATE-SPECIFIC (TODAY / DATE) OVERRIDE ====================
      const existingOverride = await db.get(
        "SELECT id FROM timetable_overrides WHERE timetable_id = ? AND date = ?",
        [slot.id, cleanDate]
      );

      if (existingOverride) {
        await db.run(`
          UPDATE timetable_overrides
          SET override_type = 'ROOM_CHANGE', original_room = ?, new_room = ?,
              new_start_time = ?, new_end_time = ?, new_subject = ?, new_teacher = ?,
              batch = ?, reason = ?, status = 'ACTIVE',
              changed_by_role = ?, changed_by_name = ?, changed_by_ug_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          slot.room,
          cleanRoom,
          new_start_time || null,
          new_end_time || null,
          new_subject || null,
          new_teacher || null,
          targetBatch,
          cleanReason,
          changedByRole,
          changedByName,
          changedByUgId,
          existingOverride.id
        ]);
        overrideId = existingOverride.id;
      } else {
        const insRes = await db.run(`
          INSERT INTO timetable_overrides (
            timetable_id, date, override_type, original_room, new_room,
            new_start_time, new_end_time, new_subject, new_teacher,
            batch, reason, status, changed_by_role, changed_by_name, changed_by_ug_id
          ) VALUES (?, ?, 'ROOM_CHANGE', ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
        `, [
          slot.id,
          cleanDate,
          slot.room,
          cleanRoom,
          new_start_time || null,
          new_end_time || null,
          new_subject || null,
          new_teacher || null,
          targetBatch,
          cleanReason,
          changedByRole,
          changedByName,
          changedByUgId
        ]);
        overrideId = insRes.id;
      }

      // Record audit history
      await db.run(`
        INSERT INTO timetable_override_history (
          timetable_id, date, subject, day, start_time, end_time, action, old_room, new_room, reason, batch, changed_by_role, changed_by_name, changed_by_ug_id
        ) VALUES (?, ?, ?, ?, ?, ?, 'ROOM_CHANGE', ?, ?, ?, ?, ?, ?, ?)
      `, [
        slot.id,
        cleanDate,
        finalSubject,
        slot.day,
        finalStartTime,
        finalEndTime,
        slot.room,
        cleanRoom,
        cleanReason,
        targetBatch,
        changedByRole,
        changedByName,
        changedByUgId
      ]);
    }

    // ==================== DISPATCH AUTOMATIC NOTIFICATION ====================
    try {
      const notifTitle = `🔔 Classroom Changed: ${finalSubject}`;
      const notifMsg = `Your ${finalSubject} class has been moved from Room ${slot.room} to Room ${cleanRoom} on ${cleanDate || targetDay} (${finalStartTime}–${finalEndTime}). Reason: ${cleanReason} [Updated by ${changedByName} (${changedByRole})]`;
      const targetType = targetBatch === 'Batch 1' ? 'BATCH_1' : targetBatch === 'Batch 2' ? 'BATCH_2' : 'ALL';
      await db.run(`
        INSERT INTO notifications (title, message, type, target_type, target_batch)
        VALUES (?, ?, 'ALERT', ?, ?)
      `, [notifTitle, notifMsg, targetType, targetBatch !== 'Both' ? targetBatch : null]);
    } catch (notifErr) {
      console.warn('[TimetableController] Notification dispatch failed:', notifErr.message);
    }

    // ==================== REAL-TIME SSE BROADCAST ====================
    realtime.broadcastEvent({
      type: 'TIMETABLE_CHANGED',
      action: changeType === 'PERMANENT' ? 'PERMANENT_CHANGE' : 'ROOM_CHANGE',
      batch: targetBatch,
      timetable_id: slot.id,
      subject: finalSubject,
      teacher: finalTeacher,
      original_room: slot.room,
      new_room: cleanRoom,
      date: cleanDate,
      day: targetDay,
      start_time: finalStartTime,
      end_time: finalEndTime,
      change_type: changeType,
      changed_by_name: changedByName,
      changed_by_role: changedByRole,
      reason: cleanReason
    });

    return res.json({
      success: true,
      message: `Room for ${finalSubject} (${targetBatch}) successfully updated from Room ${slot.room} to Room ${cleanRoom}.`,
      change_type: changeType,
      batch: targetBatch,
      override: {
        id: overrideId,
        timetable_id: slot.id,
        date: cleanDate,
        subject: finalSubject,
        teacher: finalTeacher,
        original_room: slot.room,
        new_room: cleanRoom,
        start_time: finalStartTime,
        end_time: finalEndTime,
        batch: targetBatch,
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
        timetable_id, date, subject, day, start_time, end_time, action, old_room, new_room, reason, batch, changed_by_role, changed_by_name, changed_by_ug_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'CANCELLED', ?, 'CANCELLED', ?, ?, ?, ?, ?)
    `, [timetable_id, cleanDate, slot.subject, slot.day, slot.start_time, slot.end_time, slot.room, cleanReason, slot.batch || 'Both', changedByRole, changedByName, changedByUgId]);

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

    // Broadcast SSE
    realtime.broadcastEvent({
      type: 'TIMETABLE_CANCELLED',
      timetable_id: slot.id,
      batch: slot.batch || 'Both',
      subject: slot.subject,
      date: cleanDate,
      day: slot.day,
      reason: cleanReason
    });

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
          timetable_id, date, subject, day, start_time, end_time, action, old_room, new_room, reason, batch, changed_by_role, changed_by_name, changed_by_ug_id
        ) VALUES (?, ?, ?, ?, ?, ?, 'REVERTED', ?, ?, 'Reverted to regular master timetable', ?, ?, ?, ?)
      `, [slot.id, override.date, slot.subject, slot.day, slot.start_time, slot.end_time, override.new_room || 'CANCELLED', slot.room, override.batch || slot.batch || 'Both', changedByRole, changedByName, user.ug_id || null]);
    }

    // Broadcast SSE
    realtime.broadcastEvent({
      type: 'TIMETABLE_REVERTED',
      timetable_id: override.timetable_id,
      batch: override.batch || 'Both',
      date: override.date
    });

    return res.json({
      success: true,
      message: `Temporary override removed. Schedule reverted to regular timetable (${slot ? slot.room : 'Regular'}).`
    });
  } catch (err) {
    console.error('[TimetableController] revertClassOverride error:', err);
    return res.status(500).json({ success: false, message: 'Failed to revert override.' });
  }
}

// ==================== 10. GET ROOM CHANGE & OVERRIDE HISTORY LOG (Admin & Authorized CR) ====================
async function getOverrideHistory(req, res) {
  try {
    const user = req.user;
    const isAdmin = user.role === 'ADMIN';

    // Verify CR permissions if not admin
    let crBatches = 'Both';
    if (!isAdmin) {
      const student = await db.get("SELECT is_cr, cr_batches, batch FROM students WHERE ug_id = ? OR id = ?", [user.ug_id || '', user.id || 0]);
      if (!student || student.is_cr !== 1) {
        return res.status(403).json({ success: false, message: 'Access denied: Only authorized CRs or Admins can view change history.' });
      }
      crBatches = student.cr_batches || student.batch || 'Both';
    }

    const { date, batch, limit = 100 } = req.query;
    let sql = "SELECT * FROM timetable_override_history WHERE 1=1";
    const params = [];

    if (date) {
      sql += " AND date = ?";
      params.push(date);
    }

    // Filter by batch
    if (batch && (batch === 'Batch 1' || batch === 'Batch 2')) {
      sql += " AND (batch = ? OR batch = 'Both' OR batch IS NULL)";
      params.push(batch);
    } else if (!isAdmin && crBatches !== 'Both') {
      sql += " AND (batch = ? OR batch = 'Both' OR batch IS NULL)";
      params.push(crBatches);
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
