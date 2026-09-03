const db = require('../db');

// 1. Student: Get Notifications Targeted to this Student (All, Batch, or UG ID)
async function getStudentNotifications(req, res) {
  try {
    const ugId = req.user.ug_id;
    const batch = req.user.batch; // 'Batch 1' or 'Batch 2'
    const targetBatch = batch === 'Batch 1' ? 'BATCH_1' : 'BATCH_2';

    const sql = `
      SELECT * FROM notifications
      WHERE target_type = 'ALL'
         OR (target_type = ? OR target_batch = ?)
         OR (target_type = 'STUDENT' AND target_ug_id = ?)
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const notifications = await db.query(sql, [targetBatch, batch, ugId]);

    return res.json({ success: true, data: notifications });
  } catch (err) {
    console.error('[NotificationController] getStudentNotifications error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve notifications.' });
  }
}

// 2. Admin: Send Notification (Requirement #44)
async function sendNotification(req, res) {
  try {
    const { title, message, type, target_type, target_ug_id } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and Message are required.' });
    }

    const tType = target_type || 'ALL';
    let tBatch = null;
    if (tType === 'BATCH_1') tBatch = 'Batch 1';
    if (tType === 'BATCH_2') tBatch = 'Batch 2';

    let cleanUgId = null;
    if (tType === 'STUDENT' && target_ug_id) {
      const rawTarget = target_ug_id.trim().toUpperCase();
      let student = await db.get("SELECT ug_id FROM students WHERE UPPER(ug_id) = ?", [rawTarget]);
      if (!student) {
        const rollNum = parseInt(rawTarget.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(rollNum)) {
          student = await db.get("SELECT ug_id FROM students WHERE roll_number = ?", [rollNum]);
        }
      }
      cleanUgId = student ? student.ug_id : rawTarget;
    }

    const result = await db.run(`
      INSERT INTO notifications (title, message, type, target_type, target_batch, target_ug_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [title, message, type || 'INFO', tType, tBatch, cleanUgId]);

    return res.status(201).json({
      success: true,
      message: 'Notification sent successfully.',
      id: result.id
    });
  } catch (err) {
    console.error('[NotificationController] sendNotification error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send notification.' });
  }
}

// 3. Admin: Get All Notifications
async function getAllNotifications(req, res) {
  try {
    const notifications = await db.query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100");
    return res.json({ success: true, data: notifications });
  } catch (err) {
    console.error('[NotificationController] getAllNotifications error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve notifications.' });
  }
}

// 4. Admin: Delete Notification
async function deleteNotification(req, res) {
  try {
    const { id } = req.params;
    await db.run("DELETE FROM notifications WHERE id = ?", [id]);
    return res.json({ success: true, message: 'Notification deleted.' });
  } catch (err) {
    console.error('[NotificationController] deleteNotification error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete notification.' });
  }
}

module.exports = {
  getStudentNotifications,
  sendNotification,
  getAllNotifications,
  deleteNotification
};
