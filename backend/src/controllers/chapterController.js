const Chapter = require('../models/Chapter');
const cacheService = require('../services/cacheService');
const { validateQuery, validateChapters } = require('../utils/validation');

// @desc    Get all chapters with filtering and pagination
// @route   GET /api/v1/chapters
// @access  Public
const getChapters = async (req, res, next) => {
  try {
    // Validate query parameters
    const { error, value: validatedQuery } = validateQuery(req.query);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.details.map(detail => detail.message),
      });
    }

    const { class: className, unit, status, weakChapters, subject, page, limit } = validatedQuery;

    // Generate cache key
    const cacheKey = cacheService.generateCacheKey('/api/v1/chapters', validatedQuery);
    
    // Try to get from cache first
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(
        ...cachedData,
        
      );
    }

    // Build filter object
    const filter = {};
    
    if (className) filter.class = className;
    if (unit) filter.unit = unit;
    if (status) filter.status = status;
    if (subject) filter.subject = subject;
    if (weakChapters) filter.isWeakChapter = weakChapters === 'true';

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const [chapters, totalChapters] = await Promise.all([
      Chapter.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Chapter.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalChapters / limit);

    const responseData = {
      success: true,
      count: chapters.length,
      totalChapters,
      totalPages,
      currentPage: page,
      // v2
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      data: chapters,
      // v2
      cached: false,
    };

    // Cache the response
    await cacheService.set(cacheKey, responseData);

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error in getChapters:', error);
    next(error);
  }
};

// @desc    Get single chapter
// @route   GET /api/v1/chapters/:id
// @access  Public
const getChapter = async (req, res, next) => {
  try {
    const chapter = await Chapter.findById(req.params.id);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        error: 'Chapter not found',
      });
    }

    res.status(200).json({
      success: true,
      data: chapter,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload chapters (Admin only)
// @route   POST /api/v1/chapters
// @access  Private/Admin
const uploadChapters = async (req, res, next) => {
  try {
    let chaptersData;

    // Check if data is sent in request body or as file
    if (req.file) {
      try {
        const fileContent = req.file.buffer.toString('utf8');
        chaptersData = JSON.parse(fileContent);
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid JSON file format',
        });
      }
    } else if (req.body && Array.isArray(req.body)) {
      chaptersData = req.body;
    } else {
      return res.status(400).json({
        success: false,
        error: 'No chapters data provided. Send as JSON array in body or upload JSON file.',
      });
    }

    if (!Array.isArray(chaptersData) || chaptersData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Chapters data must be a non-empty array',
      });
    }

    // Validate all chapters
    const validationResult = validateChapters(chaptersData);
    
    const uploadedChapters = [];
    const failedChapters = validationResult.invalid;

    // Upload valid chapters
    if (validationResult.valid.length > 0) {
      try {
        const savedChapters = await Chapter.insertMany(validationResult.valid, {
          ordered: false, // Continue inserting even if some documents fail
        });
        uploadedChapters.push(...savedChapters);
      } catch (bulkError) {
        // Handle duplicate key errors and other database errors
        if (bulkError.writeErrors) {
          bulkError.writeErrors.forEach(writeError => {
            const failedDoc = validationResult.valid[writeError.index];
            failedChapters.push({
              index: writeError.index,
              chapter: failedDoc,
              errors: [writeError.errmsg || 'Database error'],
            });
          });
        }
        
        // Add successfully inserted documents
        if (bulkError.insertedDocs) {
          uploadedChapters.push(...bulkError.insertedDocs);
        }
      }
    }

    // Invalidate cache after successful uploads
    if (uploadedChapters.length > 0) {
      await cacheService.invalidateChapterCache();
    }

    res.status(201).json({
      success: true,
      message: `${uploadedChapters.length} chapters uploaded successfully`,
      data: {
        uploadedCount: uploadedChapters.length,
        failedCount: failedChapters.length,
        uploadedChapters: uploadedChapters.map(chapter => ({
          id: chapter._id,
          subject: chapter.subject,
          chapter: chapter.chapter,
          class: chapter.class,
        })),
        failedChapters: failedChapters.map(failed => ({
          index: failed.index,
          chapter: {
            subject: failed.chapter.subject,
            chapter: failed.chapter.chapter,
            class: failed.chapter.class,
          },
          errors: failed.errors,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChapters,
  getChapter,
  uploadChapters,
};