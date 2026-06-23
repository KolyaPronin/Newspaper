const multer = require('multer');
const path = require('path');
const fs = require('fs');

const exportsDir = path.join(__dirname, '../../uploads/exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, exportsDir);
  },
  filename: (req, file, cb) => {
    const issueId = req.params.id || 'issue';
    cb(null, `issue-${issueId}-${Date.now()}.pdf`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
    return;
  }
  cb(new Error('Разрешены только PDF-файлы'), false);
};

const pdfUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

module.exports = pdfUpload;
