const xlsx = require('xlsx');
const db = require('../db');

// Helper to normalize and auto-map Excel column keys
function findColumnValue(row, possibleKeys) {
  const keys = Object.keys(row);
  for (const pk of possibleKeys) {
    const foundKey = keys.find(k => k.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === pk.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      return String(row[foundKey]).trim();
    }
  }
  return null;
}

// 1. Admin: Bulk Upload Excel Sheet for Results
async function uploadResultsExcel(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an Excel file (.xlsx, .xls, or .csv).' });
    }

    // Read workbook from buffer
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ success: false, message: 'The uploaded Excel file contains no data rows.' });
    }

    const processed = [];
    const skipped = [];
    let successCount = 0;

    for (let index = 0; index < rawRows.length; index++) {
      const row = rawRows[index];
      const rowNum = index + 2; // Excel row index

      // Auto-detect columns
      const ugIdRaw = findColumnValue(row, ['ug_id', 'ugid', 'ug number', 'ug no', 'ugnumber', 'student ug id', 'enrollment no', 'registration no', 'roll_ug']);
      const subjectRaw = findColumnValue(row, ['subject', 'subject name', 'course', 'paper', 'sub']);
      const examNameRaw = findColumnValue(row, ['exam_name', 'exam', 'examination', 'exam type', 'test name', 'test']) || 'Semester Exam';
      const semesterRaw = findColumnValue(row, ['semester', 'sem', 'term']) || '3rd Semester';
      const marksRaw = findColumnValue(row, ['marks', 'marks scored', 'obtained marks', 'score', 'theory marks']);
      const maxMarksRaw = findColumnValue(row, ['max_marks', 'max marks', 'total marks', 'maximum marks', 'out of']) || '100';
      const remarksRaw = findColumnValue(row, ['remarks', 'remark', 'comments', 'feedback']) || '';
      let gradeRaw = findColumnValue(row, ['grade', 'letter grade']);

      if (!ugIdRaw || !subjectRaw || marksRaw === null || marksRaw === '') {
        skipped.push({
          row: rowNum,
          reason: `Missing required fields (UG ID: "${ugIdRaw || ''}", Subject: "${subjectRaw || ''}", Marks: "${marksRaw || ''}")`
        });
        continue;
      }

      const cleanUgId = ugIdRaw.toUpperCase();
      const student = await db.get("SELECT id, name, roll_number, batch FROM students WHERE UPPER(ug_id) = ?", [cleanUgId]);

      if (!student) {
        skipped.push({
          row: rowNum,
          ug_id: cleanUgId,
          reason: `Student with UG ID "${cleanUgId}" is not registered in 3CYBER7 roster.`
        });
        continue;
      }

      const m = parseFloat(marksRaw);
      const maxM = parseFloat(maxMarksRaw) || 100;

      if (isNaN(m) || m < 0) {
        skipped.push({
          row: rowNum,
          ug_id: cleanUgId,
          reason: `Invalid numeric marks value: "${marksRaw}"`
        });
        continue;
      }

      // Compute grade if blank
      if (!gradeRaw) {
        const pct = (m / maxM) * 100;
        if (pct >= 90) gradeRaw = 'AA';
        else if (pct >= 80) gradeRaw = 'AB';
        else if (pct >= 70) gradeRaw = 'BB';
        else if (pct >= 60) gradeRaw = 'BC';
        else if (pct >= 50) gradeRaw = 'CC';
        else if (pct >= 40) gradeRaw = 'CD';
        else gradeRaw = 'FF';
      }

      // Check existing record
      const existing = await db.get(
        "SELECT id FROM results WHERE ug_id = ? AND exam_name = ? AND semester = ? AND subject = ?",
        [cleanUgId, examNameRaw, semesterRaw, subjectRaw]
      );

      if (existing) {
        await db.run(`
          UPDATE results
          SET marks = ?, max_marks = ?, grade = ?, remarks = ?
          WHERE id = ?
        `, [m, maxM, gradeRaw, remarksRaw, existing.id]);
      } else {
        await db.run(`
          INSERT INTO results (ug_id, exam_name, semester, subject, marks, max_marks, grade, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [cleanUgId, examNameRaw, semesterRaw, subjectRaw, m, maxM, gradeRaw, remarksRaw]);
      }

      // Also create announcement notification for student
      try {
        await db.run(`
          INSERT INTO notifications (title, message, target_type, target_ug_id, type)
          VALUES (?, ?, 'STUDENT', ?, 'EXAM')
        `, [
          `🏆 Results Published: ${subjectRaw}`,
          `Your official result for ${examNameRaw} (${subjectRaw}) has been published. Score: ${m}/${maxM} (Grade ${gradeRaw}).`,
          cleanUgId
        ]);
      } catch (e) {
        console.warn('Non-fatal notification insert error:', e.message);
      }

      successCount++;
      processed.push({
        ug_id: cleanUgId,
        student_name: student.name,
        roll_number: student.roll_number,
        subject: subjectRaw,
        exam_name: examNameRaw,
        marks: m,
        max_marks: maxM,
        grade: gradeRaw
      });
    }

    return res.json({
      success: true,
      message: `Bulk Excel processing complete! Successfully imported ${successCount} student result records.`,
      importedCount: successCount,
      skippedCount: skipped.length,
      processed,
      skipped
    });

  } catch (err) {
    console.error('[ExcelController] uploadResultsExcel error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to process Excel file. Please ensure it is a valid spreadsheet.'
    });
  }
}

// 2. Download Pre-Formatted Excel Template for Results
function downloadResultsTemplate(req, res) {
  try {
    const templateData = [
      {
        'UG ID': '26UG033181',
        'Student Name': 'Arvind Mishra',
        'Subject': 'Database Management System',
        'Exam Name': 'Mid-Semester Exam',
        'Semester': '3rd Semester',
        'Marks': 28.5,
        'Max Marks': 30,
        'Grade': 'AA',
        'Remarks': 'Excellent SQL queries'
      },
      {
        'UG ID': '26UG033182',
        'Student Name': 'Aarav Sharma',
        'Subject': 'Network & Cyber Security',
        'Exam Name': 'Mid-Semester Exam',
        'Semester': '3rd Semester',
        'Marks': 26,
        'Max Marks': 30,
        'Grade': 'AB',
        'Remarks': 'Great packet analysis'
      },
      {
        'UG ID': '26UG033183',
        'Student Name': 'Priya Patel',
        'Subject': 'Data Structures & Algorithms',
        'Exam Name': 'Mid-Semester Exam',
        'Semester': '3rd Semester',
        'Marks': 27.5,
        'Max Marks': 30,
        'Grade': 'AA',
        'Remarks': 'Flawless AVL Tree implementation'
      }
    ];

    const worksheet = xlsx.utils.json_to_sheet(templateData);
    // Set auto column width
    worksheet['!cols'] = [
      { wch: 15 }, // UG ID
      { wch: 20 }, // Name
      { wch: 30 }, // Subject
      { wch: 20 }, // Exam
      { wch: 15 }, // Sem
      { wch: 10 }, // Marks
      { wch: 12 }, // Max Marks
      { wch: 10 }, // Grade
      { wch: 28 }  // Remarks
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Results_Entry_Sheet');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="MGI_Cyber_Results_Bulk_Template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);

  } catch (err) {
    console.error('[ExcelController] downloadResultsTemplate error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate template.' });
  }
}

module.exports = {
  uploadResultsExcel,
  downloadResultsTemplate
};
