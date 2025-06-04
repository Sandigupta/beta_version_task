const mongoose = require('mongoose');

const yearWiseQuestionCountSchema = new mongoose.Schema({
  2019: { type: Number, default: 0 },
  2020: { type: Number, default: 0 },
  2021: { type: Number, default: 0 },
  2022: { type: Number, default: 0 },
  2023: { type: Number, default: 0 },
  2024: { type: Number, default: 0 },
  2025: { type: Number, default: 0 },
}, { _id: false });

const chapterSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
  },
  chapter: {
    type: String,
    required: [true, 'Chapter name is required'],
    trim: true,
  },
  class: {
    type: String,
    required: [true, 'Class is required'],
    trim: true,
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    trim: true,
  },
  yearWiseQuestionCount: {
    type: yearWiseQuestionCountSchema,
    required: true,
  },
  questionSolved: {
    type: Number,
    required: true,
    min: [0, 'Questions solved cannot be negative'],
    default: 0,
  },
  status: {
    type: String,
    required: true,
    enum: ['Not Started', 'In Progress', 'Completed'],
    default: 'Not Started',
  },
  isWeakChapter: {
    type: Boolean,
    required: true,
    default: false,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for better query performance
chapterSchema.index({ subject: 1, class: 1 });
chapterSchema.index({ status: 1 });
chapterSchema.index({ isWeakChapter: 1 });
chapterSchema.index({ unit: 1 });

// Virtual for total questions across all years
chapterSchema.virtual('totalQuestions').get(function() {
  const years = Object.values(this.yearWiseQuestionCount.toObject());
  return years.reduce((total, count) => total + count, 0);
});

module.exports = mongoose.model('Chapter', chapterSchema);