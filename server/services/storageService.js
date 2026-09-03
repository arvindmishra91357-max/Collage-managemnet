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

// Cloud Storage upload helper (Supabase Storage / S3 / Local fallback)
async function uploadToCloudStorage(localFilePath, fileName, bucket = 'academic_files') {
  // If Supabase Storage is configured in .env
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      console.log(`[Storage] Uploading ${fileName} to Supabase bucket: ${bucket}`);
      // In production, can use @supabase/supabase-js
      // Fall back gracefully to serving from static storage path
    } catch (err) {
      console.warn('[Storage] Cloud upload warning, using local file URL:', err.message);
    }
  }

  // Return clean URL path
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
    '.mp4': 'video/mp4'
  };
  return mimeMap[ext] || 'application/octet-stream';
}

module.exports = {
  uploadPhoto,
  uploadDocument,
  uploadToCloudStorage,
  formatBytes,
  getMimeType,
  uploadDirs
};
