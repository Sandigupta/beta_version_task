// routes/chapter.js (new file for single chapter)
const express = require('express');
const { getChapter } = require('../controllers/chapterController');

const router = express.Router();

// Single chapter route
router.get('/:id', getChapter); // GET /api/v1/chapter/:id - Get chapter by ID

module.exports = router;