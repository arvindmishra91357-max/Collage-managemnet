const bcrypt = require('bcryptjs');
const db = require('../db');

// Calculate batch automatically: Roll 1-30 -> Batch 1; Roll 31+ -> Batch 2
function determineBatch(rollNumber) {
  const roll = parseInt(rollNumber, 10);
  if (isNaN(roll)) return 'Batch 1';
  return roll <= 30 ? 'Batch 1' : 'Batch 2';
}

// 1. Admin Add Student (Name, UG ID, Password, Roll Number, Phone Number)
async function addStudent(req, res) {
  try {
    const { name, ug_id, password, roll_number, phone_number } = req.body;

    // Strict validation of the 4 required fields
    if (!name || !ug_id || !password || roll_number === undefined || roll_number === '') {
      return res.status(400).json({
        success: false,
        message: 'All 4 fields are required: Student Name, UG ID, Password, and Roll Number.'
      });
    }

    const cleanUgId = ug_id.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanPhone = phone_number ? phone_number.trim() : null;
    const rollNum = parseInt(roll_number, 10);

    if (isNaN(rollNum) || rollNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Roll Number must be a positive integer.'
      });
    }

    // Automatic Configuration
    const program = 'B.Tech Cyber Security';
    const year = '2nd Year';
    const semester = '3rd Semester';
    const division = '3CYBER7';
    const academicYear = '2026-27';
    const batch = determineBatch(rollNum);

    const passwordHash = await bcrypt.hash(password.trim(), 10);

    // Check if student already exists by UG ID or Roll Number
    const existing = await db.get(
      "SELECT id, ug_id, roll_number, name FROM students WHERE UPPER(ug_id) = ? OR roll_number = ?",
      [cleanUgId, rollNum]
    );

    if (existing) {
      // Smoothly update existing student profile & credentials instead of rejecting
      await db.run(`
        UPDATE students
        SET name = ?, roll_number = ?, ug_id = ?, phone_number = COALESCE(?, phone_number),
            password_hash = ?, batch = ?, status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [cleanName, rollNum, cleanUgId, cleanPhone, passwordHash, batch, existing.id]);

      // Sync user authentication record
      const existingUser = await db.get("SELECT id FROM users WHERE UPPER(ug_id) = ? OR UPPER(ug_id) = ?", [cleanUgId, existing.ug_id.toUpperCase()]);
      if (existingUser) {
        await db.run("UPDATE users SET ug_id = ?, password_hash = ?, status = 'ACTIVE' WHERE id = ?", [cleanUgId, passwordHash, existingUser.id]);
      } else {
        await db.run("INSERT INTO users (role, ug_id, password_hash, status) VALUES ('STUDENT', ?, ?, 'ACTIVE')", [cleanUgId, passwordHash]);
      }

      return res.json({
        success: true,
        message: `Student ${cleanName} (Roll #${rollNum}, ${cleanUgId}) stored and updated successfully! Assigned to ${batch}.`,
        student: {
          id: existing.id,
          ug_id: cleanUgId,
          name: cleanName,
          roll_number: rollNum,
          phone_number: cleanPhone,
          batch,
          program,
          year,
          semester,
          division,
          academic_year: academicYear,
          status: 'ACTIVE'
        }
      });
    }

    // Insert new student record
    const result = await db.run(`
      INSERT INTO students (
        ug_id, name, roll_number, phone_number, password_hash, batch, program, year, semester, division, academic_year, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `, [cleanUgId, cleanName, rollNum, cleanPhone, passwordHash, batch, program, year, semester, division, academicYear]);

    // Insert user auth entry
    await db.run(
      "INSERT INTO users (role, ug_id, password_hash, status) VALUES (?, ?, ?, 'ACTIVE')",
      ['STUDENT', cleanUgId, passwordHash]
    );

    return res.status(201).json({
      success: true,
      message: `Student ${cleanName} created successfully with UG ID ${cleanUgId}. Automatically assigned to ${batch}.`,
      student: {
        id: result.id,
        ug_id: cleanUgId,
        name: cleanName,
        roll_number: rollNum,
        phone_number: cleanPhone,
        batch,
        program,
        year,
        semester,
        division,
        academic_year: academicYear,
        status: 'ACTIVE'
      }
    });
  } catch (err) {
    console.error('[StudentController] addStudent error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create student.' });
  }
}

// 2. Get All Students (Supports search, batch filtering, pagination)
async function getAllStudents(req, res) {
  try {
    const { batch, search, page = 1, limit = 100 } = req.query;
    let sql = "SELECT id, ug_id, name, roll_number, phone_number, batch, program, year, semester, division, academic_year, profile_photo_url, is_cr, status, created_at FROM students WHERE 1=1";
    const params = [];

    if (batch && (batch === 'Batch 1' || batch === 'Batch 2')) {
      sql += " AND batch = ?";
      params.push(batch);
    }

    if (search && search.trim() !== '') {
      sql += " AND (UPPER(name) LIKE ? OR UPPER(ug_id) LIKE ? OR CAST(roll_number AS TEXT) LIKE ? OR phone_number LIKE ?)";
      const s = `%${search.trim().toUpperCase()}%`;
      params.push(s, s, s, `%${search.trim()}%`);
    }

    sql += " ORDER BY roll_number ASC";

    const students = await db.query(sql, params);

    // Calculate Summary Stats
    const total = students.length;
    const batch1Count = students.filter(s => s.batch === 'Batch 1').length;
    const batch2Count = students.filter(s => s.batch === 'Batch 2').length;
    const crCount = students.filter(s => s.is_cr === 1).length;

    return res.json({
      success: true,
      data: students,
      stats: {
        total,
        batch1: batch1Count,
        batch2: batch2Count,
        crCount
      }
    });
  } catch (err) {
    console.error('[StudentController] getAllStudents error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch students list.' });
  }
}

// 3. Get Single Student
async function getStudentById(req, res) {
  try {
    const { id } = req.params;
    const student = await db.get(
      "SELECT id, ug_id, name, roll_number, phone_number, batch, program, year, semester, division, academic_year, profile_photo_url, is_cr, status, created_at FROM students WHERE id = ? OR ug_id = ?",
      [id, id]
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    return res.json({ success: true, data: student });
  } catch (err) {
    console.error('[StudentController] getStudentById error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch student details.' });
  }
}

// 4. Update Student
async function updateStudent(req, res) {
  try {
    const { id } = req.params;
    const { name, roll_number, phone_number, password, status, is_cr } = req.body;

    const student = await db.get("SELECT * FROM students WHERE id = ? OR ug_id = ?", [id, id]);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    let updatedBatch = student.batch;
    let rollNum = student.roll_number;

    if (roll_number !== undefined && roll_number !== '') {
      rollNum = parseInt(roll_number, 10);
      updatedBatch = determineBatch(rollNum);
    }

    const updatedName = name ? name.trim() : student.name;
    const updatedPhone = phone_number !== undefined ? (phone_number ? phone_number.trim() : null) : student.phone_number;
    const updatedStatus = status || student.status;
    const updatedCr = is_cr !== undefined ? (is_cr ? 1 : 0) : (student.is_cr || 0);

    let updatedPassHash = student.password_hash;
    if (password && password.trim() !== '') {
      updatedPassHash = await bcrypt.hash(password.trim(), 10);
      await db.run("UPDATE users SET password_hash = ? WHERE ug_id = ?", [updatedPassHash, student.ug_id]);
    }

    await db.run(`
      UPDATE students
      SET name = ?, roll_number = ?, phone_number = ?, batch = ?, status = ?, is_cr = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [updatedName, rollNum, updatedPhone, updatedBatch, updatedStatus, updatedCr, updatedPassHash, student.id]);

    return res.json({
      success: true,
      message: 'Student updated successfully.',
      student: {
        id: student.id,
        ug_id: student.ug_id,
        name: updatedName,
        roll_number: rollNum,
        phone_number: updatedPhone,
        batch: updatedBatch,
        is_cr: updatedCr,
        status: updatedStatus
      }
    });
  } catch (err) {
    console.error('[StudentController] updateStudent error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update student.' });
  }
}

// 5. Toggle CR Status
async function toggleCRStatus(req, res) {
  try {
    const { id } = req.params;
    const { is_cr } = req.body;

    const student = await db.get("SELECT * FROM students WHERE id = ? OR ug_id = ?", [id, id]);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const newCrStatus = is_cr !== undefined ? (is_cr ? 1 : 0) : (student.is_cr === 1 ? 0 : 1);

    await db.run("UPDATE students SET is_cr = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newCrStatus, student.id]);

    return res.json({
      success: true,
      message: `Student ${student.name} is now ${newCrStatus === 1 ? 'designated as Class Representative (CR)' : 'removed from Class Representative (CR)'}.`,
      is_cr: newCrStatus
    });
  } catch (err) {
    console.error('[StudentController] toggleCRStatus error:', err);
    return res.status(500).json({ success: false, message: 'Failed to toggle CR status.' });
  }
}

// 6. Delete Student
async function deleteStudent(req, res) {
  try {
    const { id } = req.params;
    const student = await db.get("SELECT * FROM students WHERE id = ? OR ug_id = ?", [id, id]);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Delete auth user & student
    await db.run("DELETE FROM users WHERE ug_id = ?", [student.ug_id]);
    await db.run("DELETE FROM students WHERE id = ?", [student.id]);
    await db.run("DELETE FROM attendance_records WHERE ug_id = ?", [student.ug_id]);
    await db.run("DELETE FROM attendance_manual WHERE ug_id = ?", [student.ug_id]);

    return res.json({
      success: true,
      message: `Student ${student.name} (${student.ug_id}) deleted successfully.`
    });
  } catch (err) {
    console.error('[StudentController] deleteStudent error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete student.' });
  }
}

module.exports = {
  addStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  toggleCRStatus,
  deleteStudent
};
