import { Schema, model, type ObjectId } from '../../lib/mongoose';

export interface UserSession {
  sid: string;
  tokenHash: string;
  /** Previous refresh token hash, accepted for a short grace window (parallel refresh calls). */
  prevTokenHash?: string;
  rotatedAt?: Date;
  createdAt: Date;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}

export interface UserDoc {
  _id: ObjectId;
  orgId: ObjectId | null;
  name: string;
  email: string;
  phone?: string;
  passwordHash?: string;
  roleKey: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  invitePending: boolean;
  avatarUrl?: string;
  lastLoginAt?: Date;
  sessions: UserSession[];
  inviteTokenHash?: string;
  inviteExpiresAt?: Date;
  invitedBy?: ObjectId;
  resetTokenHash?: string;
  resetExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<UserSession>(
  {
    sid: { type: String, required: true },
    tokenHash: { type: String, required: true },
    prevTokenHash: String,
    rotatedAt: Date,
    createdAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
    userAgent: String,
    ip: String,
  },
  { _id: false },
);

const userSchema = new Schema<UserDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', default: null, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    phone: String,
    passwordHash: String,
    roleKey: { type: String, required: true },
    isSuperAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    invitePending: { type: Boolean, default: false },
    avatarUrl: String,
    lastLoginAt: Date,
    sessions: { type: [sessionSchema], default: [] },
    inviteTokenHash: { type: String, index: { sparse: true } },
    inviteExpiresAt: Date,
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resetTokenHash: { type: String, index: { sparse: true } },
    resetExpiresAt: Date,
  },
  { timestamps: true },
);
userSchema.index({ orgId: 1, roleKey: 1 });
userSchema.index({ orgId: 1, isActive: 1 });

export const User = model<UserDoc>('User', userSchema);

/** Fields used when a user is embedded as a `UserRef`. */
export const USER_REF = 'name email roleKey';
