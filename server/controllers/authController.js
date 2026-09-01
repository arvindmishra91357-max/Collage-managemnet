const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken } = require('../middleware/auth');

// 1. Student Login (UG ID + Password)
async function studentLogin(req, res) {
  try {
    const { ug_id, password } = req.body;

    if (!ug_id || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both UG ID and Password.'
      });
    }

    const cleanUgId = ug_id.trim().toUpperCase();

    // Query student record
    const student = await db.get("SELECT * FROM students WHERE UPPER(ug_id) = ?", [cleanUgId]);

    if (!student) {
      return res.status(401).json({
        success: false,
        message: 'Invalid UG ID or Password. Please check your credentials.'
      });
    }

    if (student.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Your student account is inactive. Please contact the Department Admin.'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, student.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid UG ID or Password. Please check your credentials.'
      });
    }

    // Generate JWT token
    const token = generateToken({
      id: student.id,
      ug_id: student.ug_id,
      name: student.name,
      roll_number: student.roll_number,
      batch: student.batch,
      program: student.program,
      semester: student.semester,
      division: student.division,
      academic_year: student.academic_year,
      role: 'STUDENT'
    });

    // Return student profile info (NO email, phone, dob, parent fields)
    return res.json({
      success: true,
      message: 'Student login successful.',
      token,
      user: {
        role: 'STUDENT',
        ug_id: student.ug_id,
        name: student.name,
        roll_number: student.roll_number,
        batch: student.batch,
        program: student.program,
        year: student.year,
        semester: student.semester,
        division: student.division,
        academic_year: student.academic_year,
        profile_photo_url: student.profile_photo_url || null
      }
    });
  } catch (err) {
    console.error('[Auth] studentLogin error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during login.' });
  }
}

// 2. Admin Login (Admin ID / Username + Password)
async function adminLogin(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both Admin ID and Password.'
      });
    }

    const cleanUser = username.trim();
    const admin = await db.get("SELECT * FROM users WHERE (username = ? OR ug_id = ?) AND role = 'ADMIN'", [cleanUser, cleanUser]);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Admin credentials.'
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Admin credentials.'
      });
    }

    const token = generateToken({
      id: admin.id,
      username: admin.username,
      role: 'ADMIN'
    });

    return res.json({
      success: true,
      message: 'Admin login successful.',
      token,
      user: {
        role: 'ADMIN',
        username: admin.username,
        name: 'Portal Administrator'
      }
    });
  } catch (err) {
    console.error('[Auth] adminLogin error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during admin login.' });
  }
}

// 3. Get Current Profile
async function getProfile(req, res) {
  try {
    if (req.user.role === 'STUDENT') {
      const student = await db.get("SELECT * FROM students WHERE ug_id = ?", [req.user.ug_id]);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      return res.json({
        success: true,
        user: {
          role: 'STUDENT',
          ug_id: student.ug_id,
          name: student.name,
          roll_number: student.roll_number,
          batch: student.batch,
          program: student.program,
          year: student.year,
          semester: student.semester,
          division: student.division,
          academic_year: student.academic_year,
          profile_photo_url: student.profile_photo_url || null,
          status: student.status
        }
      });
    } else if (req.user.role === 'ADMIN') {
      return res.json({
        success: true,
        user: {
          role: 'ADMIN',
          username: req.user.username,
          name: 'Portal Administrator'
        }
      });
    }
  } catch (err) {
    console.error('[Auth] getProfile error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
  }
}

// 4. Student Self-Service Profile Photo Upload (Requirement #11)
async function uploadProfilePhoto(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo file uploaded.' });
    }

    const photoUrl = `/uploads/photos/${req.file.filename}`;
    const ugId = req.user.ug_id;

    await db.run("UPDATE students SET profile_photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE ug_id = ?", [photoUrl, ugId]);

    return res.json({
      success: true,
      message: 'Profile photo updated successfully.',
      profile_photo_url: photoUrl
    });
  } catch (err) {
    console.error('[Auth] uploadProfilePhoto error:', err);
    return res.status(500).json({ success: false, message: 'Failed to upload profile photo.' });
  }
}

module.exports = {
  studentLogin,
  adminLogin,
  getProfile,
  uploadProfilePhoto
};
