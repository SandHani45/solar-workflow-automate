import { Schema, model, type ObjectId } from '../../lib/mongoose';

export interface NotificationDoc {
  _id: ObjectId;
  orgId: ObjectId;
  userId: ObjectId;
  title: string;
  body: string;
  link?: string;
  readAt?: Date | null;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: String,
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
notificationSchema.index({ orgId: 1, userId: 1, createdAt: -1 });
notificationSchema.index({ orgId: 1, userId: 1, readAt: 1 });

export const Notification = model<NotificationDoc>('Notification', notificationSchema);
