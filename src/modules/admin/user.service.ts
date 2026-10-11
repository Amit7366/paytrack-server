import mongoose from "mongoose";
import { ROLES, Role } from "../../common/constants/roles";
import { AppError } from "../../common/errors/AppError";
import { addMoney } from "../../common/money";
import { Payment } from "../payment/payment.model";
import { User } from "../user/user.model";

type Actor = { id: string; role: Role };

type Money = {
  totalUsd: string;
  totalBdt: string;
  paidUsd: string;
  paidBdt: string;
  unpaidUsd: string;
  unpaidBdt: string;
};

const emptyMoney = (): Money => ({
  totalUsd: "0.00",
  totalBdt: "0.00",
  paidUsd: "0.00",
  paidBdt: "0.00",
  unpaidUsd: "0.00",
  unpaidBdt: "0.00",
});

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const paymentTotals = async (ids: mongoose.Types.ObjectId[]) => {
  const totals = new Map<string, Money>();
  if (ids.length === 0) return totals;

  const rows = await Payment.aggregate<{
    _id: { userId: mongoose.Types.ObjectId; status: "paid" | "unpaid" };
    usd: unknown;
    bdt: unknown;
  }>([
    { $match: { userId: { $in: ids } } },
    {
      $group: {
        _id: { userId: "$userId", status: "$status" },
        usd: { $sum: "$amountUsd" },
        bdt: { $sum: "$amountBdt" },
      },
    },
  ]);

  for (const row of rows) {
    const key = row._id.userId.toString();
    const money = totals.get(key) ?? emptyMoney();
    money.totalUsd = addMoney(money.totalUsd, row.usd);
    money.totalBdt = addMoney(money.totalBdt, row.bdt);
    if (row._id.status === "paid") {
      money.paidUsd = addMoney(money.paidUsd, row.usd);
      money.paidBdt = addMoney(money.paidBdt, row.bdt);
    } else {
      money.unpaidUsd = addMoney(money.unpaidUsd, row.usd);
      money.unpaidBdt = addMoney(money.unpaidBdt, row.bdt);
    }
    totals.set(key, money);
  }
  return totals;
};

const toManagedUser = (
  user: { _id: { toString(): string }; name: string; email: string; isActive: boolean; createdAt?: Date },
  money: Money,
) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  isActive: user.isActive,
  createdAt: user.createdAt,
  ...money,
});

const scopeFilter = (actor: Actor) => {
  const filter: Record<string, unknown> = { role: ROLES.USER };
  if (actor.role === ROLES.ADMIN) filter.createdById = actor.id;
  return filter;
};

const findManagedUser = async (actor: Actor, id: string) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError("User not found", 404);
  const user = await User.findOne({ ...scopeFilter(actor), _id: id }).select("+password");
  if (!user) throw new AppError("User not found", 404);
  return user;
};

export const listManagedUsers = async (
  actor: Actor,
  input: { search: string; status: "all" | "active" | "inactive"; page: number; limit: number },
) => {
  const filter = scopeFilter(actor);
  if (input.status === "active") filter.isActive = true;
  if (input.status === "inactive") filter.isActive = false;
  if (input.search) {
    const pattern = new RegExp(escapeRegex(input.search), "i");
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip((input.page - 1) * input.limit)
    .limit(input.limit);
  const totals = await paymentTotals(users.map((user) => user._id));

  return {
    users: users.map((user) => toManagedUser(user, totals.get(user._id.toString()) ?? emptyMoney())),
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / input.limit)),
  };
};

export const getManagedUser = async (actor: Actor, id: string) => {
  const user = await findManagedUser(actor, id);
  const totals = await paymentTotals([user._id]);
  return toManagedUser(user, totals.get(user._id.toString()) ?? emptyMoney());
};

export const createManagedUser = async (actor: Actor, input: { name: string; email: string; password: string }) => {
  const email = input.email.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) throw new AppError("An account with this email already exists", 409);

  const user = await User.create({
    name: input.name,
    email,
    password: input.password,
    role: ROLES.USER,
    createdById: actor.id,
    isActive: true,
  });

  return toManagedUser(user, emptyMoney());
};

export const updateManagedUser = async (
  actor: Actor,
  id: string,
  input: { name?: string; email?: string; password?: string; isActive?: boolean },
) => {
  const user = await findManagedUser(actor, id);

  if (input.email) {
    const email = input.email.toLowerCase();
    const existing = await User.findOne({ email, _id: { $ne: user._id } });
    if (existing) throw new AppError("An account with this email already exists", 409);
    user.email = email;
  }
  if (input.name) user.name = input.name;
  if (input.password) user.password = input.password;
  if (typeof input.isActive === "boolean") user.isActive = input.isActive;

  await user.save();
  const totals = await paymentTotals([user._id]);
  return toManagedUser(user, totals.get(user._id.toString()) ?? emptyMoney());
};

export const deleteManagedUser = async (actor: Actor, id: string) => {
  const user = await findManagedUser(actor, id);
  const paymentCount = await Payment.countDocuments({ userId: user._id });

  if (paymentCount > 0) {
    user.isActive = false;
    await user.save();
    return { id: user._id.toString(), mode: "soft" as const, isActive: false };
  }

  await user.deleteOne();
  return { id: user._id.toString(), mode: "hard" as const, isActive: false };
};
