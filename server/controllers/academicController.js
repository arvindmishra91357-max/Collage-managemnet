const db = require('../db');
const { formatBytes } = require('../services/storageService');

// ==================== CLASS NOTES ====================

// 1. Get Class Notes (Supports Subject, Unit, Search filtering)
async function getClassNotes(req, res) {
  try {
    const { subject, unit, search } = req.query;
    let sql = "SELECT * FROM class_notes WHERE 1=1";
    const params = [];

    if (subject && subject !== 'ALL') {
      sql += " AND subject = ?";
      params.push(subject);
    }
    if (unit && unit !== 'ALL') {
      sql += " AND unit = ?";
      params.push(unit);
    }
    if (search && search.trim() !== '') {
      sql += " AND (UPPER(title) LIKE ? OR UPPER(chapter) LIKE ? OR UPPER(topic) LIKE ? OR UPPER(description) LIKE ?)";
      const s = `%${search.trim().toUpperCase()}%`;
      params.push(s, s, s, s);
    }

    sql += " ORDER BY subject ASC, unit ASC, created_at DESC";
    const notes = await db.query(sql, params);

    return res.json({ success: true, data: notes });
  } catch (err) {
    console.error('[AcademicController] getClassNotes error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve class notes.' });
  }
}

// 2. Admin: Upload Class Notes
async function uploadClassNote(req, res) {
  try {
    const { subject, unit, chapter, topic, title, description } = req.body;

    if (!subject || !unit || !title) {
      return res.status(400).json({
        success: false,
        message: 'Subject, Unit, and Note Title are required.'
      });
    }

    let fileUrl = '/uploads/notes/sample_notes.pdf';
    let fileName = 'Class_Notes.pdf';
    let fileSize = '1.5 MB';
    let fileType = 'pdf';

    if (req.file) {
      fileUrl = `/uploads/notes/${req.file.filename}`;
      fileName = req.file.originalname;
      fileSize = formatBytes(req.file.size);
      fileType = req.file.mimetype.split('/')[1] || 'pdf';
    }

    const result = await db.run(`
      INSERT INTO class_notes (
        subject, unit, chapter, topic, title, description, file_url, file_name, file_size, file_type, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Admin')
    `, [subject, unit, chapter || '', topic || '', title, description || '', fileUrl, fileName, fileSize, fileType]);

    // Create automated notification for students
    await db.run(`
      INSERT INTO notifications (title, message, type, target_type)
      VALUES (?, ?, 'ACADEMIC', 'ALL')
    `, [`New Notes Uploaded: ${subject} (${unit})`, `New notes for ${subject} (${title}) have been uploaded by faculty.`, 'ACADEMIC']);

    return res.status(201).json({
      success: true,
      message: 'Class note uploaded successfully.',
      id: result.id
    });
  } catch (err) {
    console.error('[AcademicController] uploadClassNote error:', err);
    return res.status(500).json({ success: false, message: 'Failed to upload class note.' });
  }
}

// 3. Admin: Delete Class Note
async function deleteClassNote(req, res) {
  try {
    const { id } = req.params;
    await db.run("DELETE FROM class_notes WHERE id = ?", [id]);
    return res.json({ success: true, message: 'Class note deleted successfully.' });
  } catch (err) {
    console.error('[AcademicController] deleteClassNote error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete class note.' });
  }
}

// ==================== STUDY MATERIAL ====================

// 4. Get Study Materials
async function getStudyMaterials(req, res) {
  try {
    const { subject, category, search } = req.query;
    let sql = "SELECT * FROM study_material WHERE 1=1";
    const params = [];

    if (subject && subject !== 'ALL') {
      sql += " AND subject = ?";
      params.push(subject);
    }
    if (category && category !== 'ALL') {
      sql += " AND category = ?";
      params.push(category);
    }
    if (search && search.trim() !== '') {
      sql += " AND (UPPER(title) LIKE ? OR UPPER(description) LIKE ?)";
      const s = `%${search.trim().toUpperCase()}%`;
      params.push(s, s);
    }

    sql += " ORDER BY created_at DESC";
    const materials = await db.query(sql, params);

    return res.json({ success: true, data: materials });
  } catch (err) {
    console.error('[AcademicController] getStudyMaterials error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve study materials.' });
  }
}

// 5. Admin: Upload Study Material
async function uploadStudyMaterial(req, res) {
  try {
    const { subject, title, description, category } = req.body;

    if (!subject || !title) {
      return res.status(400).json({ success: false, message: 'Subject and Title are required.' });
    }

    let fileUrl = '/uploads/material/sample_material.pdf';
    let fileName = 'Study_Material.pdf';
    let fileSize = '2.0 MB';
    let fileType = 'pdf';

    if (req.file) {
      fileUrl = `/uploads/material/${req.file.filename}`;
      fileName = req.file.originalname;
      fileSize = formatBytes(req.file.size);
      fileType = req.file.mimetype.split('/')[1] || 'pdf';
    }

    const result = await db.run(`
      INSERT INTO study_material (
        subject, title, description, category, file_url, file_name, file_size, file_type, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Admin')
    `, [subject, title, description || '', category || 'REFERENCE', fileUrl, fileName, fileSize, fileType]);

    return res.status(201).json({
      success: true,
      message: 'Study material uploaded successfully.',
      id: result.id
    });
  } catch (err) {
    console.error('[AcademicController] uploadStudyMaterial error:', err);
    return res.status(500).json({ success: false, message: 'Failed to upload study material.' });
  }
}

// 6. Admin: Delete Study Material
async function deleteStudyMaterial(req, res) {
  try {
    const { id } = req.params;
    await db.run("DELETE FROM study_material WHERE id = ?", [id]);
    return res.json({ success: true, message: 'Study material deleted successfully.' });
  } catch (err) {
    console.error('[AcademicController] deleteStudyMaterial error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete study material.' });
  }
}

// ==================== ASSIGNMENTS ====================

// 7. Get Assignments
async function getAssignments(req, res) {
  try {
    const { subject } = req.query;
    let sql = "SELECT * FROM assignments WHERE 1=1";
    const params = [];

    if (subject && subject !== 'ALL') {
      sql += " AND subject = ?";
      params.push(subject);
    }

    sql += " ORDER BY due_date ASC, created_at DESC";
    const assignments = await db.query(sql, params);

    return res.json({ success: true, data: assignments });
  } catch (err) {
    console.error('[AcademicController] getAssignments error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve assignments.' });
  }
}

// 8. Admin: Create Assignment
async function createAssignment(req, res) {
  try {
    const { subject, title, description, due_date, max_marks } = req.body;

    if (!subject || !title || !due_date) {
      return res.status(400).json({
        success: false,
        message: 'Subject, Title, and Due Date are required.'
      });
    }

    let attachmentUrl = null;
    let attachmentName = null;
    let attachmentSize = null;

    if (req.file) {
      attachmentUrl = `/uploads/assignments/${req.file.filename}`;
      attachmentName = req.file.originalname;
      attachmentSize = formatBytes(req.file.size);
    }

    const result = await db.run(`
      INSERT INTO assignments (
        subject, title, description, due_date, max_marks, attachment_url, attachment_name, attachment_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [subject, title, description || '', due_date, max_marks ? parseInt(max_marks, 10) : 100, attachmentUrl, attachmentName, attachmentSize]);

    // Create Notification
    await db.run(`
      INSERT INTO notifications (title, message, type, target_type)
      VALUES (?, ?, 'ALERT', 'ALL')
    `, [`New Assignment: ${subject}`, `New assignment '${title}' due on ${due_date}. Check Study Hub.`, 'ALERT']);

    return res.status(201).json({
      success: true,
      message: 'Assignment created successfully.',
      id: result.id
    });
  } catch (err) {
    console.error('[AcademicController] createAssignment error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create assignment.' });
  }
}

// 9. Admin: Delete Assignment
async function deleteAssignment(req, res) {
  try {
    const { id } = req.params;
    await db.run("DELETE FROM assignments WHERE id = ?", [id]);
    return res.json({ success: true, message: 'Assignment deleted successfully.' });
  } catch (err) {
    console.error('[AcademicController] deleteAssignment error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete assignment.' });
  }
}

// ==================== QUESTION PAPERS ====================

// 10. Get Question Papers
async function getQuestionPapers(req, res) {
  try {
    const { subject, exam_name, semester, academic_year } = req.query;
    let sql = "SELECT * FROM question_papers WHERE 1=1";
    const params = [];

    if (subject && subject !== 'ALL') {
      sql += " AND subject = ?";
      params.push(subject);
    }
    if (exam_name && exam_name !== 'ALL') {
      sql += " AND exam_name = ?";
      params.push(exam_name);
    }
    if (semester && semester !== 'ALL') {
      sql += " AND semester = ?";
      params.push(semester);
    }
    if (academic_year && academic_year !== 'ALL') {
      sql += " AND academic_year = ?";
      params.push(academic_year);
    }

    sql += " ORDER BY academic_year DESC, created_at DESC";
    const papers = await db.query(sql, params);

    return res.json({ success: true, data: papers });
  } catch (err) {
    console.error('[AcademicController] getQuestionPapers error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve question papers.' });
  }
}

// 11. Admin: Upload Question Paper
async function uploadQuestionPaper(req, res) {
  try {
    const { subject, exam_name, semester, academic_year } = req.body;

    if (!subject || !exam_name) {
      return res.status(400).json({ success: false, message: 'Subject and Exam Name are required.' });
    }

    let fileUrl = '/uploads/papers/sample_paper.pdf';
    let fileName = `${subject}_${exam_name}.pdf`;
    let fileSize = '1.0 MB';

    if (req.file) {
      fileUrl = `/uploads/papers/${req.file.filename}`;
      fileName = req.file.originalname;
      fileSize = formatBytes(req.file.size);
    }

    const result = await db.run(`
      INSERT INTO question_papers (
        subject, exam_name, semester, academic_year, file_url, file_name, file_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [subject, exam_name, semester || '3rd Semester', academic_year || '2026-27', fileUrl, fileName, fileSize]);

    return res.status(201).json({
      success: true,
      message: 'Question paper uploaded successfully.',
      id: result.id
    });
  } catch (err) {
    console.error('[AcademicController] uploadQuestionPaper error:', err);
    return res.status(500).json({ success: false, message: 'Failed to upload question paper.' });
  }
}

// 12. Admin: Delete Question Paper
async function deleteQuestionPaper(req, res) {
  try {
    const { id } = req.params;
    await db.run("DELETE FROM question_papers WHERE id = ?", [id]);
    return res.json({ success: true, message: 'Question paper deleted successfully.' });
  } catch (err) {
    console.error('[AcademicController] deleteQuestionPaper error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete question paper.' });
  }
}

// ==================== ACADEMIC CALENDAR ====================

// 13. Get Calendar Events
async function getAcademicCalendar(req, res) {
  try {
    const events = await db.query("SELECT * FROM academic_calendar ORDER BY start_date ASC");
    return res.json({ success: true, data: events });
  } catch (err) {
    console.error('[AcademicController] getAcademicCalendar error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve academic calendar.' });
  }
}

// 14. Admin: Add Calendar Event
async function addCalendarEvent(req, res) {
  try {
    const { title, event_type, start_date, end_date, description } = req.body;
    if (!title || !event_type || !start_date) {
      return res.status(400).json({ success: false, message: 'Title, Event Type, and Start Date are required.' });
    }

    const result = await db.run(`
      INSERT INTO academic_calendar (title, event_type, start_date, end_date, description)
      VALUES (?, ?, ?, ?, ?)
    `, [title, event_type, start_date, end_date || start_date, description || '']);

    return res.status(201).json({ success: true, message: 'Calendar event added.', id: result.id });
  } catch (err) {
    console.error('[AcademicController] addCalendarEvent error:', err);
    return res.status(500).json({ success: false, message: 'Failed to add calendar event.' });
  }
}

// 15. Admin: Delete Calendar Event
async function deleteCalendarEvent(req, res) {
  try {
    const { id } = req.params;
    await db.run("DELETE FROM academic_calendar WHERE id = ?", [id]);
    return res.json({ success: true, message: 'Event deleted successfully.' });
  } catch (err) {
    console.error('[AcademicController] deleteCalendarEvent error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete event.' });
  }
}

// ==================== ANNOUNCEMENTS ====================

// 16. Get Announcements
async function getAnnouncements(req, res) {
  try {
    const announcements = await db.query("SELECT * FROM announcements ORDER BY created_at DESC LIMIT 30");
    return res.json({ success: true, data: announcements });
  } catch (err) {
    console.error('[AcademicController] getAnnouncements error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve announcements.' });
  }
}

// 17. Admin: Create Announcement
async function createAnnouncement(req, res) {
  try {
    const { title, content, category, priority } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and Content are required.' });
    }

    const result = await db.run(`
      INSERT INTO announcements (title, content, category, priority)
      VALUES (?, ?, ?, ?)
    `, [title, content, category || 'GENERAL', priority || 'NORMAL']);

    return res.status(201).json({ success: true, message: 'Announcement published successfully.', id: result.id });
  } catch (err) {
    console.error('[AcademicController] createAnnouncement error:', err);
    return res.status(500).json({ success: false, message: 'Failed to publish announcement.' });
  }
}

// 18. Admin: Delete Announcement
async function deleteAnnouncement(req, res) {
  try {
    const { id } = req.params;
    await db.run("DELETE FROM announcements WHERE id = ?", [id]);
    return res.json({ success: true, message: 'Announcement deleted.' });
  } catch (err) {
    console.error('[AcademicController] deleteAnnouncement error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete announcement.' });
  }
}

module.exports = {
  getClassNotes,
  uploadClassNote,
  deleteClassNote,
  getStudyMaterials,
  uploadStudyMaterial,
  deleteStudyMaterial,
  getAssignments,
  createAssignment,
  deleteAssignment,
  getQuestionPapers,
  uploadQuestionPaper,
  deleteQuestionPaper,
  getAcademicCalendar,
  addCalendarEvent,
  deleteCalendarEvent,
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement
};
