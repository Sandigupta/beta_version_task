const express = require('express');
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const {
  getChapters,
  getChapter,
  uploadChapters,
} = require('../controllers/chapterController');

const router = express.Router();

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'), false);
    }
  },
});

// Public routes
router.route('/').get(getChapters); // Less specific route

// router.route('/:id').get(getChapter); // More specific route
// Protected routes (Admin only)
router.route('/').post( protect, authorize('admin'), upload.single('file'), uploadChapters);




module.exports = router;