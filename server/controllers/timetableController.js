const db = require('../db');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Helper to get current day name
function getCurrentDay() {
  const date = new Date();
  const dayName = DAYS[date.getDay()];
  return dayName === 'Sunday' ? 'Monday' : dayName; // Default Sunday to Monday schedule preview
}

// Helper to convert time string to absolute minutes from midnight (09:30 -> 570 mins, 01:15 -> 795 mins)
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const clean = timeStr.trim();
  const parts = clean.split(':');
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  
  // Convert 12-hour afternoon hours (01:xx to 07:xx PM) to 24-hour equivalent
  if (h >= 1 && h <= 7) {
    h += 12;
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

// 1. Get Timetable for Student (Filtered by Batch & Day)
async function getStudentTimetable(req, res) {
  try {
    const studentBatch = req.user ? req.user.batch : (req.query.batch || 'Batch 2');
    const { day } = req.query;

    let sql = "SELECT * FROM timetable WHERE active = 1 AND (batch = ? OR batch = 'Both')";
    const params = [studentBatch];

    if (day && day !== 'ALL') {
      sql += " AND day = ?";
      params.push(day);
    }

    sql += TIMETABLE_ORDER_BY;

    const rows = await db.query(sql, params);

    // Secondary JavaScript sort guarantee
    rows.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

    return res.json({
      success: true,
      data: rows,
      studentBatch,
      currentDay: getCurrentDay()
    });
  } catch (err) {
    console.error('[TimetableController] getStudentTimetable error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve timetable.' });
  }
}

// 2. Get Today's Classes & Next Class for Student
async function getTodayClasses(req, res) {
  try {
    const studentBatch = req.user ? req.user.batch : (req.query.batch || 'Batch 2');
    const requestedDay = req.query.day || getCurrentDay();

    const sql = `
      SELECT * FROM timetable
      WHERE active = 1 AND day = ? AND (batch = ? OR batch = 'Both')
      ${TIMETABLE_ORDER_BY}
    `;
    const classes = await db.query(sql, [requestedDay, studentBatch]);

    // Chronological sort ensuring 09:30 AM is at index 0
    classes.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let liveClass = null;
    let nextClass = null;
    let minDiff = Infinity;

    const formattedClasses = classes.map(c => {
      const startMin = timeToMinutes(c.start_time);
      const endMin = timeToMinutes(c.end_time);

      let status = 'UPCOMING';
      if (currentMinutes >= startMin && currentMinutes <= endMin) {
        status = 'LIVE NOW';
        liveClass = c;
      } else if (currentMinutes > endMin) {
        status = 'COMPLETED';
      } else if (currentMinutes < startMin) {
        const diff = startMin - currentMinutes;
        if (diff < minDiff) {
          minDiff = diff;
          nextClass = { ...c, startsInMinutes: diff };
        }
      }

      return {
        ...c,
        status
      };
    });

    return res.json({
      success: true,
      currentDay: requestedDay,
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

// 3. Admin: Get Full Timetable (All Days, All Batches)
async function getAllTimetable(req, res) {
  try {
    const sql = `
      SELECT * FROM timetable
      ${TIMETABLE_ORDER_BY}
    `;
    const rows = await db.query(sql);

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
      data: rows
    });
  } catch (err) {
    console.error('[TimetableController] getAllTimetable error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve timetable.' });
  }
}

// 4. Admin: Create Timetable Entry
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

// 5. Admin: Update Timetable Entry (Instant sync to students)
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
    return res.json({ success: true, message: 'Timetable entry deleted successfully.' });
  } catch (err) {
    console.error('[TimetableController] deleteTimetableEntry error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete timetable entry.' });
  }
}

module.exports = {
  getStudentTimetable,
  getTodayClasses,
  getAllTimetable,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry
};
