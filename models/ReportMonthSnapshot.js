const mongoose = require('mongoose');

const criteriaSnapshotSchema = new mongoose.Schema(
  {
    criteriaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Criteria' },
    code: { type: String, required: true },
    name: { type: String, required: true },
    part: { type: String },
    chapter: { type: String },
    currentLevel: { type: Number, default: 0 },
    expectedLevel: { type: Number, default: 1 },
    progress: { type: Number, default: 0 },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    departmentName: { type: String, default: 'Chưa gán' },
    weightedScore: { type: Number, default: 0 },
  },
  { _id: false },
);

const reportMonthSnapshotSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    periodKey: { type: String, required: true, unique: true },
    snapshotAt: { type: Date, default: Date.now },
    snapshotType: { type: String, enum: ['monthly_auto', 'manual'], default: 'monthly_auto' },
    summary: { type: mongoose.Schema.Types.Mixed, required: true },
    criteria: [criteriaSnapshotSchema],
  },
  { timestamps: true },
);

reportMonthSnapshotSchema.index({ year: 1, month: 1 }, { unique: true });
reportMonthSnapshotSchema.index({ snapshotAt: -1 });

module.exports = mongoose.model('ReportMonthSnapshot', reportMonthSnapshotSchema);
