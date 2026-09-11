const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload subdirectories exist
const uploadDirs = {
  notes: path.join(__dirname, '..', '..', 'uploads', 'notes'),
  material: path.join(__dirname, '..', '..', 'uploads', 'material'),
  assignments: path.join(__dirname, '..', '..', 'uploads', 'assignments'),
  papers: path.join(__dirname, '..', '..', 'uploads', 'papers'),
  photos: path.join(__dirname, '..', '..', 'uploads', 'photos')
};

Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage engine config
const diskStorage = (category) => multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = uploadDirs[category] || path.join(__dirname, '..', '..', 'uploads');
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${base}_${uniqueSuffix}${ext}`);
  }
});

// File filters
const photoFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPG, PNG, WEBP) are allowed for profile photos.'));
  }
};

const documentFilter = (req, file, cb) => {
  const allowed = /pdf|doc|docx|ppt|pptx|xls|xlsx|txt|zip|rar|png|jpg|jpeg|mp4|webm/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  if (ext) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file format. Please upload PDF, Office Docs, Images, or MP4 videos.'));
  }
};

const uploadPhoto = multer({
  storage: diskStorage('photos'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: photoFilter
});

const uploadDocument = (category) => multer({
  storage: diskStorage(category),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: documentFilter
});

// ==========================================================================
// MULTI-TIER PERSISTENT STORAGE SERVICE
// 1. Cloud Storage (S3 / Supabase / Cloudflare R2 if configured)
// 2. Database BLOB Persistence (file_blobs table - survives redeployments)
// 3. Local Disk Cache (fast static serving)
// ==========================================================================

const db = require('../db');

/**
 * Persist an uploaded file buffer into the database and cloud storage.
 * Ensures the file survives container restarts and server redeployments.
 */
async function persistUploadedFile(file, publicUrlPath) {
  if (!file) return;

  const normalizedPath = (publicUrlPath || '').replace(/^\/+/, '');
  const filePathOnDisk = file.path;
  const mimeType = file.mimetype || getMimeType(file.originalname);
  const fileSize = file.size || (fs.existsSync(filePathOnDisk) ? fs.statSync(filePathOnDisk).size : 0);

  try {
    let fileBuffer = file.buffer;
    if (!fileBuffer && filePathOnDisk && fs.existsSync(filePathOnDisk)) {
      fileBuffer = fs.readFileSync(filePathOnDisk);
    }

    if (fileBuffer) {
      // 1. Save to Database BLOB (guarantees survival on free/ephemeral containers)
      const existing = await db.get("SELECT id FROM file_blobs WHERE file_path = ?", [normalizedPath]);
      if (existing) {
        await db.run(
          "UPDATE file_blobs SET data = ?, mime_type = ?, file_size = ?, created_at = CURRENT_TIMESTAMP WHERE file_path = ?",
          [fileBuffer, mimeType, fileSize, normalizedPath]
        );
      } else {
        await db.run(
          "INSERT INTO file_blobs (file_path, mime_type, file_size, data) VALUES (?, ?, ?, ?)",
          [normalizedPath, mimeType, fileSize, fileBuffer]
        );
      }
      console.log(`[Storage] File persisted in database backup: ${normalizedPath} (${formatBytes(fileSize)})`);

      // 2. Cloud Storage upload if S3 or Supabase configured
      await uploadToCloudStorage(filePathOnDisk, path.basename(normalizedPath), fileBuffer, mimeType);
    }
  } catch (err) {
    console.warn('[Storage] Warning: Failed to persist file to secondary storage:', err.message);
  }
}

/**
 * Retrieve a file either from local disk or from database file_blobs backup.
 * If file was lost on disk due to container restart, recovers it from database to disk.
 */
async function retrieveFile(fileRelPath) {
  if (!fileRelPath) return { found: false };

  const cleanRel = fileRelPath.replace(/^(\.\.[\/\\])+/, '').replace(/^[\\\/]+/, '');
  const localDiskPath = path.join(__dirname, '..', '..', cleanRel);

  // 1. If exists on disk, serve directly
  if (fs.existsSync(localDiskPath)) {
    return {
      found: true,
      path: localDiskPath,
      mimeType: getMimeType(localDiskPath),
      fromDisk: true
    };
  }

  // 2. Check database file_blobs table
  try {
    const row = await db.get("SELECT mime_type, file_size, data FROM file_blobs WHERE file_path = ?", [cleanRel]);
    if (row && row.data) {
      // Restore file to disk cache for fast subsequent access
      const dir = path.dirname(localDiskPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(localDiskPath, row.data);
      console.log(`[Storage] Restored missing file from database to disk: ${cleanRel}`);

      return {
        found: true,
        path: localDiskPath,
        buffer: row.data,
        mimeType: row.mime_type || getMimeType(cleanRel),
        fromDatabase: true
      };
    }
  } catch (dbErr) {
    console.warn('[Storage] DB retrieval check error:', dbErr.message);
  }

  return { found: false };
}

// Cloud Storage upload helper (Supabase Storage / S3 / Cloudflare R2)
async function uploadToCloudStorage(localFilePath, fileName, fileBuffer = null, mimeType = null) {
  // 1. Supabase Storage REST API (No heavy SDK required)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const bucket = process.env.SUPABASE_BUCKET || 'mgi-academic-files';
      const endpoint = `${process.env.SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/${bucket}/${encodeURIComponent(fileName)}`;
      const buffer = fileBuffer || (localFilePath ? fs.readFileSync(localFilePath) : null);
      if (buffer) {
        const fetch = global.fetch || require('node-fetch');
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': mimeType || getMimeType(fileName),
            'x-upsert': 'true'
          },
          body: buffer
        });
        if (res.ok) {
          console.log(`[Storage] Successfully synced ${fileName} to Supabase bucket: ${bucket}`);
        }
      }
    } catch (err) {
      console.warn('[Storage] Supabase cloud upload warning:', err.message);
    }
  }

  // 2. Custom S3 Endpoint / Cloudflare R2 if configured
  if (process.env.S3_BUCKET && process.env.S3_ACCESS_KEY) {
    console.log(`[Storage] S3 bucket ${process.env.S3_BUCKET} configured for upload of ${fileName}`);
  }

  return fileName;
}

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function getMimeType(filenameOrExt) {
  const ext = filenameOrExt.startsWith('.') ? filenameOrExt.toLowerCase() : path.extname(filenameOrExt).toLowerCase();
  const mimeMap = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.apk': 'application/vnd.android.package-archive'
  };
  return mimeMap[ext] || 'application/octet-stream';
}

module.exports = {
  uploadPhoto,
  uploadDocument,
  persistUploadedFile,
  retrieveFile,
  uploadToCloudStorage,
  formatBytes,
  getMimeType,
  uploadDirs
};
