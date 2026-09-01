const db = require('../db');

// Global Search (Requirement #48)
async function globalSearch(req, res) {
  try {
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return res.json({
        success: true,
        query: '',
        results: {
          notes: [],
          material: [],
          assignments: [],
          questionPapers: [],
          notifications: []
        },
        totalCount: 0
      });
    }

    const searchTerm = `%${q.trim().toUpperCase()}%`;

    // 1. Search Class Notes
    const notes = await db.query(`
      SELECT id, 'NOTE' as type, subject, unit, title, chapter, topic, description, file_url, file_name, file_size
      FROM class_notes
      WHERE UPPER(title) LIKE ? OR UPPER(subject) LIKE ? OR UPPER(chapter) LIKE ? OR UPPER(topic) LIKE ? OR UPPER(description) LIKE ?
      LIMIT 10
    `, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]);

    // 2. Search Study Material
    const material = await db.query(`
      SELECT id, 'MATERIAL' as type, subject, title, category, description, file_url, file_name, file_size, file_type
      FROM study_material
      WHERE UPPER(title) LIKE ? OR UPPER(subject) LIKE ? OR UPPER(description) LIKE ? OR UPPER(category) LIKE ?
      LIMIT 10
    `, [searchTerm, searchTerm, searchTerm, searchTerm]);

    // 3. Search Assignments
    const assignments = await db.query(`
      SELECT id, 'ASSIGNMENT' as type, subject, title, description, due_date, max_marks, attachment_url, attachment_name
      FROM assignments
      WHERE UPPER(title) LIKE ? OR UPPER(subject) LIKE ? OR UPPER(description) LIKE ?
      LIMIT 10
    `, [searchTerm, searchTerm, searchTerm]);

    // 4. Search Question Papers
    const questionPapers = await db.query(`
      SELECT id, 'QUESTION_PAPER' as type, subject, exam_name, semester, academic_year, file_url, file_name, file_size
      FROM question_papers
      WHERE UPPER(subject) LIKE ? OR UPPER(exam_name) LIKE ? OR UPPER(academic_year) LIKE ?
      LIMIT 10
    `, [searchTerm, searchTerm, searchTerm]);

    // 5. Search Notifications
    const notifications = await db.query(`
      SELECT id, 'NOTIFICATION' as type, title, message, type as notif_type, created_at
      FROM notifications
      WHERE UPPER(title) LIKE ? OR UPPER(message) LIKE ?
      LIMIT 10
    `, [searchTerm, searchTerm]);

    const totalCount = notes.length + material.length + assignments.length + questionPapers.length + notifications.length;

    return res.json({
      success: true,
      query: q.trim(),
      totalCount,
      results: {
        notes,
        material,
        assignments,
        questionPapers,
        notifications
      }
    });
  } catch (err) {
    console.error('[SearchController] globalSearch error:', err);
    return res.status(500).json({ success: false, message: 'Global search failed.' });
  }
}

module.exports = {
  globalSearch
};
