import mongoose, { Schema } from "mongoose";

export const PAYMENT_METHODS = [
  "cashapp",
  "venmo",
  "zelle",
  "giftcard",
  "apple_gift_card",
  "google_play_gift_card",
  "btc",
  "other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = "paid" | "unpaid";

export interface IPayment {
  userId: mongoose.Types.ObjectId;
  method: PaymentMethod;
  amountUsd: mongoose.Types.Decimal128;
  rateBdt: mongoose.Types.Decimal128;
  amountBdt: mongoose.Types.Decimal128;
  paymentDate: Date;
  note: string;
  status: PaymentStatus;
  paidAt?: Date | null;
  paidById?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    method: { type: String, enum: [...PAYMENT_METHODS], required: true },
    amountUsd: { type: Schema.Types.Decimal128, required: true },
    rateBdt: { type: Schema.Types.Decimal128, required: true },
    amountBdt: { type: Schema.Types.Decimal128, required: true },
    paymentDate: { type: Date, required: true, index: true },
    note: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["paid", "unpaid"], required: true, default: "unpaid", index: true },
    paidAt: { type: Date, default: null },
    paidById: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

paymentSchema.index({ userId: 1, paymentDate: -1 });

export const Payment = mongoose.model<IPayment>("Payment", paymentSchema);
