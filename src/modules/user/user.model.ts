import bcrypt from "bcryptjs";
import mongoose, { Schema } from "mongoose";
import { ROLE_VALUES, ROLES, Role } from "../../common/constants/roles";

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
  createdById?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: [...ROLE_VALUES], default: ROLES.USER },
    isActive: { type: Boolean, default: true },
    createdById: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

userSchema.index({ createdById: 1 });

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

export const User = mongoose.model<IUser>("User", userSchema);

export const toPublicUser = (user: {
  _id: { toString(): string };
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt?: Date;
}) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
});
