const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken } = require('../middleware/auth');
const { persistUploadedFile } = require('../services/storageService');

// 1. Student Login (Strictly UG ID + Password)
async function studentLogin(req, res) {
  try {
    const { ug_id, password } = req.body;
    const cleanUgId = (ug_id || '').toString().trim().toUpperCase();

    if (!cleanUgId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both Student UG ID and Password.'
      });
    }

    // Query student record strictly by UG ID (Roll number login disabled as requested)
    const student = await db.get("SELECT * FROM students WHERE UPPER(ug_id) = ?", [cleanUgId]);

    if (!student) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Student credentials. Please login using your official UG ID (e.g. 26UG033181).'
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
        message: 'Invalid Student credentials. Please check your Password.'
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
      is_cr: student.is_cr ? 1 : 0,
      cr_batches: student.cr_batches || 'Both',
      role: 'STUDENT'
    });

    // Return student profile info
    return res.json({
      success: true,
      message: 'Student login successful.',
      token,
      user: {
        role: 'STUDENT',
        ug_id: student.ug_id,
        name: student.name,
        roll_number: student.roll_number,
        phone_number: student.phone_number || null,
        batch: student.batch,
        program: student.program,
        year: student.year,
        semester: student.semester,
        division: student.division,
        academic_year: student.academic_year,
        is_cr: student.is_cr ? 1 : 0,
        cr_batches: student.cr_batches || 'Both',
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
    const admin = await db.get("SELECT * FROM users WHERE (LOWER(username) = LOWER(?) OR LOWER(ug_id) = LOWER(?)) AND role = 'ADMIN'", [cleanUser, cleanUser]);

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
      const student = await db.get(
        "SELECT * FROM students WHERE UPPER(ug_id) = UPPER(?) OR id = ?",
        [req.user.ug_id || '', req.user.id || 0]
      );
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      return res.json({
        success: true,
        user: {
          id: student.id,
          role: 'STUDENT',
          ug_id: student.ug_id,
          name: student.name,
          roll_number: student.roll_number,
          phone_number: student.phone_number || null,
          batch: student.batch,
          program: student.program,
          year: student.year,
          semester: student.semester,
          division: student.division,
          academic_year: student.academic_year,
          is_cr: (student.is_cr === 1 || student.is_cr == 1) ? 1 : 0,
          cr_batches: student.cr_batches || 'Both',
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

    // Persist photo to database / cloud storage
    await persistUploadedFile(req.file, photoUrl);

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

// 5. Single Unified Login (Detects Admin or Student automatically)
async function unifiedLogin(req, res) {
  try {
    const { identifier, username, ug_id, password } = req.body;
    const loginId = (identifier || username || ug_id || '').trim();

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please enter both ID/Username and Password.'
      });
    }

    // A. Check Admin table first (username or ug_id)
    const admin = await db.get(
      "SELECT * FROM users WHERE (LOWER(username) = LOWER(?) OR LOWER(ug_id) = LOWER(?)) AND role = 'ADMIN'",
      [loginId, loginId]
    );

    if (admin) {
      const isMatch = await bcrypt.compare(password, admin.password_hash);
      if (isMatch) {
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
      }
    }

    // B. Check Students table strictly by UG ID (Roll number login disabled as requested)
    const cleanUgId = loginId.toUpperCase();
    const student = await db.get("SELECT * FROM students WHERE UPPER(ug_id) = ?", [cleanUgId]);

    if (student) {
      if (student.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: 'Your student account is inactive. Please contact the Department Admin.'
        });
      }

      const isMatch = await bcrypt.compare(password, student.password_hash);
      if (isMatch) {
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
          is_cr: student.is_cr ? 1 : 0,
          cr_batches: student.cr_batches || 'Both',
          role: 'STUDENT'
        });

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
            is_cr: student.is_cr ? 1 : 0,
            cr_batches: student.cr_batches || 'Both',
            profile_photo_url: student.profile_photo_url || null
          }
        });
      }
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid ID/Username or Password. Please check your credentials.'
    });
  } catch (err) {
    console.error('[Auth] unifiedLogin error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during login.' });
  }
}

// 6. Secure Password Change (Authenticated)
async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Both current password and new password are required.' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    if (req.user.role === 'STUDENT') {
      const student = await db.get("SELECT * FROM students WHERE ug_id = ?", [req.user.ug_id]);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student account not found.' });
      }

      const isMatch = await bcrypt.compare(current_password, student.password_hash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }

      const newHash = await bcrypt.hash(new_password, 10);
      await db.run("UPDATE students SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE ug_id = ?", [newHash, req.user.ug_id]);
      await db.run("UPDATE users SET password_hash = ? WHERE ug_id = ?", [newHash, req.user.ug_id]);

      return res.json({ success: true, message: 'Password changed successfully.' });
    } else if (req.user.role === 'ADMIN') {
      const admin = await db.get("SELECT * FROM users WHERE id = ? AND role = 'ADMIN'", [req.user.id]);
      if (!admin) {
        return res.status(404).json({ success: false, message: 'Admin account not found.' });
      }

      const isMatch = await bcrypt.compare(current_password, admin.password_hash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current admin password is incorrect.' });
      }

      const newHash = await bcrypt.hash(new_password, 10);
      await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, req.user.id]);

      return res.json({ success: true, message: 'Admin password changed successfully.' });
    }
  } catch (err) {
    console.error('[Auth] changePassword error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update password.' });
  }
}

// 7. Forgot Password / Identity Verification Reset
async function forgotPassword(req, res) {
  try {
    const { ug_id, phone_number, new_password } = req.body;
    const cleanUgId = (ug_id || '').toString().trim().toUpperCase();
    const cleanPhone = (phone_number || '').toString().replace(/\D/g, '');

    if (!cleanUgId || !cleanPhone || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide UG ID, registered Mobile Number, and your New Password.'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    const student = await db.get("SELECT * FROM students WHERE UPPER(ug_id) = ?", [cleanUgId]);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'No student record found with the provided UG ID.'
      });
    }

    const dbPhone = (student.phone_number || '').toString().replace(/\D/g, '');
    const phoneMatches = dbPhone && (cleanPhone.endsWith(dbPhone.slice(-10)) || dbPhone.endsWith(cleanPhone.slice(-10)));

    if (!phoneMatches) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number does not match official college registration records for this UG ID.'
      });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await db.run("UPDATE students SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE ug_id = ?", [newHash, student.ug_id]);
    await db.run("UPDATE users SET password_hash = ? WHERE ug_id = ?", [newHash, student.ug_id]);

    return res.json({
      success: true,
      message: 'Password has been securely reset. You can now login with your new password.'
    });
  } catch (err) {
    console.error('[Auth] forgotPassword error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
}

module.exports = {
  unifiedLogin,
  studentLogin,
  adminLogin,
  getProfile,
  uploadProfilePhoto,
  changePassword,
  forgotPassword
};

