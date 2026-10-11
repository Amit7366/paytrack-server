import mongoose from "mongoose";
import { ROLES } from "../../common/constants/roles";
import { AppError } from "../../common/errors/AppError";
import { addMoney, moneyString } from "../../common/money";
import { Payment } from "../payment/payment.model";
import { User } from "../user/user.model";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toAdmin = (
  user: { _id: { toString(): string }; name: string; email: string; isActive: boolean; createdAt?: Date },
  userCount: number,
  volume: { totalUsd: string; totalBdt: string },
) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  isActive: user.isActive,
  createdAt: user.createdAt,
  userCount,
  volumeUsd: volume.totalUsd,
  volumeBdt: volume.totalBdt,
});

const emptyVolume = { totalUsd: "0.00", totalBdt: "0.00" };

const adminVolumes = async (ids: mongoose.Types.ObjectId[]) => {
  if (ids.length === 0) return new Map<string, { totalUsd: string; totalBdt: string }>();
  const rows = await Payment.aggregate<{ _id: mongoose.Types.ObjectId; totalUsd: unknown; totalBdt: unknown }>([
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "owner" } },
    { $unwind: "$owner" },
    { $match: { "owner.createdById": { $in: ids }, "owner.role": ROLES.USER } },
    { $group: { _id: "$owner.createdById", totalUsd: { $sum: "$amountUsd" }, totalBdt: { $sum: "$amountBdt" } } },
  ]);
  return new Map(
    rows.map((row) => [row._id.toString(), { totalUsd: moneyString(row.totalUsd), totalBdt: moneyString(row.totalBdt) }]),
  );
};

const userCounts = async (ids: mongoose.Types.ObjectId[]) => {
  if (ids.length === 0) return new Map<string, number>();
  const rows = await User.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { createdById: { $in: ids } } },
    { $group: { _id: "$createdById", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id.toString(), row.count]));
};

const findAdmin = async (id: string) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Admin not found", 404);
  }
  const admin = await User.findOne({ _id: id, role: ROLES.ADMIN }).select("+password");
  if (!admin) throw new AppError("Admin not found", 404);
  return admin;
};

export const listAdmins = async (input: { search: string; page: number; limit: number }) => {
  const filter: Record<string, unknown> = { role: ROLES.ADMIN };
  if (input.search) {
    const pattern = new RegExp(escapeRegex(input.search), "i");
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const total = await User.countDocuments(filter);
  const admins = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip((input.page - 1) * input.limit)
    .limit(input.limit);
  const ids = admins.map((admin) => admin._id);
  const [counts, volumes] = await Promise.all([userCounts(ids), adminVolumes(ids)]);

  return {
    admins: admins.map((admin) =>
      toAdmin(admin, counts.get(admin._id.toString()) ?? 0, volumes.get(admin._id.toString()) ?? emptyVolume),
    ),
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / input.limit)),
  };
};

export const createAdmin = async (
  actorId: string,
  input: { name: string; email: string; password: string },
) => {
  const email = input.email.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) throw new AppError("An account with this email already exists", 409);

  const admin = await User.create({
    name: input.name,
    email,
    password: input.password,
    role: ROLES.ADMIN,
    createdById: actorId,
    isActive: true,
  });

  return toAdmin(admin, 0, emptyVolume);
};

export const updateAdmin = async (
  id: string,
  input: { name?: string; email?: string; password?: string; isActive?: boolean },
) => {
  const admin = await findAdmin(id);

  if (input.email) {
    const email = input.email.toLowerCase();
    const existing = await User.findOne({ email, _id: { $ne: admin._id } });
    if (existing) throw new AppError("An account with this email already exists", 409);
    admin.email = email;
  }
  if (input.name) admin.name = input.name;
  if (input.password) admin.password = input.password;
  if (typeof input.isActive === "boolean") admin.isActive = input.isActive;

  await admin.save();
  const [counts, volumes] = await Promise.all([userCounts([admin._id]), adminVolumes([admin._id])]);
  return toAdmin(admin, counts.get(admin._id.toString()) ?? 0, volumes.get(admin._id.toString()) ?? emptyVolume);
};

export const deleteAdmin = async (id: string) => {
  const admin = await findAdmin(id);
  const createdCount = await User.countDocuments({ createdById: admin._id });

  if (createdCount > 0) {
    admin.isActive = false;
    await admin.save();
    return { id: admin._id.toString(), mode: "soft" as const, isActive: false, userCount: createdCount };
  }

  await admin.deleteOne();
  return { id: admin._id.toString(), mode: "hard" as const, isActive: false, userCount: 0 };
};

export const getDashboardStats = async () => {
  const [totalAdmins, totalUsers, paymentRows] = await Promise.all([
    User.countDocuments({ role: ROLES.ADMIN }),
    User.countDocuments({ role: ROLES.USER }),
    Payment.aggregate<{ _id: "paid" | "unpaid"; usd: unknown; bdt: unknown; count: number }>([
      {
        $group: {
          _id: "$status",
          usd: { $sum: "$amountUsd" },
          bdt: { $sum: "$amountBdt" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const totals = {
    USD: "0.00",
    BDT: "0.00",
    paidUsd: "0.00",
    unpaidUsd: "0.00",
    paidBdt: "0.00",
    unpaidBdt: "0.00",
    payments: 0,
  };

  for (const row of paymentRows) {
    totals.payments += row.count;
    totals.USD = addMoney(totals.USD, row.usd);
    totals.BDT = addMoney(totals.BDT, row.bdt);
    if (row._id === "paid") {
      totals.paidUsd = addMoney(totals.paidUsd, row.usd);
      totals.paidBdt = addMoney(totals.paidBdt, row.bdt);
    } else {
      totals.unpaidUsd = addMoney(totals.unpaidUsd, row.usd);
      totals.unpaidBdt = addMoney(totals.unpaidBdt, row.bdt);
    }
  }

  return {
    totalAdmins,
    totalUsers,
    totalPayments: totals.payments,
    totalUsd: totals.USD,
    totalBdt: totals.BDT,
    paid: { usd: totals.paidUsd, bdt: totals.paidBdt },
    unpaid: { usd: totals.unpaidUsd, bdt: totals.unpaidBdt },
  };
};
