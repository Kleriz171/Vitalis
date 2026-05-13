import { Schema, model } from 'mongoose';

const CommunityPostSchema = new Schema({
  group: { type: Schema.Types.ObjectId, ref: 'CommunityGroup', required: true, index: true },
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  authorName: String,
  isAnonymous: { type: Boolean, default: false },
  content: { type: String, required: true },
  likes: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
}, { timestamps: true });

export const CommunityPost = model('CommunityPost', CommunityPostSchema);
