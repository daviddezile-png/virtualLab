const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    clientId: {
      type:   String,
      unique: true,
      sparse: true,
    },
    title: {
      type:     String,
      required: true,
      trim:     true,
    },
    body: {
      type:     String,
      required: true,
      trim:     true,
    },
    authorId: {
      type:    String,
      default: '',
      ref:     'User',
    },
    authorName: {
      type:    String,
      default: '',
    },
    // Target audience label (display only)
    target: {
      type:    String,
      default: 'All Students',
    },
  },
  { timestamps: true }
);

announcementSchema.index({ authorId: 1 });
announcementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
