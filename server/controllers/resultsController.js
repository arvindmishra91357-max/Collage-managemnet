const db = require('../db');

// 1. Student: Get Own Results (Requirement #46, #54)
async function getStudentResults(req, res) {
  try {
    const ugId = req.user.ug_id;
    const results = await db.query(
      "SELECT * FROM results WHERE ug_id = ? ORDER BY semester ASC, subject ASC",
      [ugId]
    );

    // Calculate CGPA / SGPA aggregate
    let totalMarks = 0;
    let totalMaxMarks = 0;
    results.forEach(r => {
      totalMarks += parseFloat(r.marks) || 0;
      totalMaxMarks += parseFloat(r.max_marks) || 100;
    });

    const percentage = totalMaxMarks > 0 ? ((totalMarks / totalMaxMarks) * 100).toFixed(2) : '0.00';

    return res.json({
      success: true,
      ug_id: ugId,
      results,
      summary: {
        totalSubjects: results.length,
        totalMarksScored: totalMarks,
        maxPossibleMarks: totalMaxMarks,
        percentage
      }
    });
  } catch (err) {
    console.error('[ResultsController] getStudentResults error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve results.' });
  }
}

// 2. Admin: Enter or Update Result
async function addOrUpdateResult(req, res) {
  try {
    const { ug_id, exam_name, semester, subject, marks, max_marks, grade, remarks } = req.body;

    if (!ug_id || !exam_name || !subject || marks === undefined) {
      return res.status(400).json({
        success: false,
        message: 'UG ID, Exam Name, Subject, and Marks are required.'
      });
    }

    const cleanUgId = ug_id.trim().toUpperCase();
    const student = await db.get("SELECT id, name FROM students WHERE ug_id = ?", [cleanUgId]);
    if (!student) {
      return res.status(404).json({ success: false, message: `Student with UG ID ${cleanUgId} not found.` });
    }

    const m = parseFloat(marks);
    const maxM = parseFloat(max_marks) || 100;

    // Automatic grade calculation if not supplied
    let calculatedGrade = grade;
    if (!calculatedGrade) {
      const pct = (m / maxM) * 100;
      if (pct >= 90) calculatedGrade = 'AA';
      else if (pct >= 80) calculatedGrade = 'AB';
      else if (pct >= 70) calculatedGrade = 'BB';
      else if (pct >= 60) calculatedGrade = 'BC';
      else if (pct >= 50) calculatedGrade = 'CC';
      else if (pct >= 40) calculatedGrade = 'CD';
      else calculatedGrade = 'FF';
    }

    const sem = semester || '3rd Semester';

    const existing = await db.get(
      "SELECT id FROM results WHERE ug_id = ? AND exam_name = ? AND semester = ? AND subject = ?",
      [cleanUgId, exam_name, sem, subject]
    );

    if (existing) {
      await db.run(`
        UPDATE results
        SET marks = ?, max_marks = ?, grade = ?, remarks = ?
        WHERE id = ?
      `, [m, maxM, calculatedGrade, remarks || '', existing.id]);
    } else {
      await db.run(`
        INSERT INTO results (ug_id, exam_name, semester, subject, marks, max_marks, grade, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [cleanUgId, exam_name, sem, subject, m, maxM, calculatedGrade, remarks || '']);
    }

    return res.status(201).json({
      success: true,
      message: `Result recorded for ${student.name} (${cleanUgId}) - ${subject}: ${m}/${maxM} (${calculatedGrade}).`
    });
  } catch (err) {
    console.error('[ResultsController] addOrUpdateResult error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record student result.' });
  }
}

// 3. Admin: Get All Results
async function getAllResults(req, res) {
  try {
    const { subject, exam_name, semester } = req.query;
    let sql = `
      SELECT r.*, s.name as student_name, s.roll_number, s.batch
      FROM results r
      JOIN students s ON r.ug_id = s.ug_id
      WHERE 1=1
    `;
    const params = [];

    if (subject && subject !== 'ALL') {
      sql += " AND r.subject = ?";
      params.push(subject);
    }
    if (exam_name && exam_name !== 'ALL') {
      sql += " AND r.exam_name = ?";
      params.push(exam_name);
    }
    if (semester && semester !== 'ALL') {
      sql += " AND r.semester = ?";
      params.push(semester);
    }

    sql += " ORDER BY s.roll_number ASC, r.subject ASC";

    const rows = await db.query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[ResultsController] getAllResults error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve results.' });
  }
}

// 4. Admin: Delete Result
async function deleteResult(req, res) {
  try {
    const { id } = req.params;
    await db.run("DELETE FROM results WHERE id = ?", [id]);
    return res.json({ success: true, message: 'Result deleted.' });
  } catch (err) {
    console.error('[ResultsController] deleteResult error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete result.' });
  }
}

module.exports = {
  getStudentResults,
  addOrUpdateResult,
  getAllResults,
  deleteResult
};
