const Joi = require('joi');

// Chapter validation schema
const chapterSchema = Joi.object({
  subject: Joi.string().trim().required().messages({
    'string.empty': 'Subject is required',
    'any.required': 'Subject is required',
  }),
  chapter: Joi.string().trim().required().messages({
    'string.empty': 'Chapter name is required',
    'any.required': 'Chapter name is required',
  }),
  class: Joi.string().trim().required().messages({
    'string.empty': 'Class is required',
    'any.required': 'Class is required',
  }),
  unit: Joi.string().trim().required().messages({
    'string.empty': 'Unit is required',
    'any.required': 'Unit is required',
  }),
  yearWiseQuestionCount: Joi.object({
    2019: Joi.number().integer().min(0).default(0),
    2020: Joi.number().integer().min(0).default(0),
    2021: Joi.number().integer().min(0).default(0),
    2022: Joi.number().integer().min(0).default(0),
    2023: Joi.number().integer().min(0).default(0),
    2024: Joi.number().integer().min(0).default(0),
    2025: Joi.number().integer().min(0).default(0),
  }).required(),
  questionSolved: Joi.number().integer().min(0).required().messages({
    'number.min': 'Questions solved cannot be negative',
    'any.required': 'Questions solved is required',
  }),
  status: Joi.string().valid('Not Started', 'In Progress', 'Completed').required(),
  isWeakChapter: Joi.boolean().required(),
});

// Query validation schema
const querySchema = Joi.object({
  class: Joi.string().trim(),
  unit: Joi.string().trim(),
  status: Joi.string().valid('Not Started', 'In Progress', 'Completed'),
  weakChapters: Joi.string().valid('true', 'false'),
  subject: Joi.string().trim(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

const validateChapter = (data) => {
  return chapterSchema.validate(data, { abortEarly: false });
};

const validateQuery = (query) => {
  return querySchema.validate(query, { abortEarly: false });
};

const validateChapters = (chapters) => {
  const results = {
    valid: [],
    invalid: [],
  };

  chapters.forEach((chapter, index) => {
    const { error, value } = validateChapter(chapter);
    if (error) {
      results.invalid.push({
        index,
        chapter,
        errors: error.details.map(detail => detail.message),
      });
    } else {
      results.valid.push(value);
    }
  });

  return results;
};

module.exports = {
  validateChapter,
  validateQuery,
  validateChapters,
};