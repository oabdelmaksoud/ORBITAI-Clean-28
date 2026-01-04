import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  userId?: string; // Admin user ID (null for system-wide notifications)
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  category: 'system' | 'user' | 'project' | 'financial' | 'security';
  isRead: boolean;
  link?: string; // Optional link to related resource
  metadata?: Record<string, any>;
  createdAt: Date;
  readAt?: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: String,
      index: true,
      sparse: true // Allow null for system-wide notifications
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['info', 'warning', 'error', 'success'],
      default: 'info',
      index: true
    },
    category: {
      type: String,
      enum: ['system', 'user', 'project', 'financial', 'security'],
      default: 'system',
      index: true
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    link: {
      type: String
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    readAt: {
      type: Date
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes for efficient queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
















