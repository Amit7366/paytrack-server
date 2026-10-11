import mongoose, { ClientSession } from "mongoose";
import { paymentAccess } from "../../common/access";
import { ROLES, Role } from "../../common/constants/roles";
import { AppError } from "../../common/errors/AppError";
import { addMoney, bdtFromUsd, decimalZero, money, moneyString, storedMoney } from "../../common/money";
import { withTransaction } from "../../common/utils/transaction";
import { writeAudit } from "../audit/audit-log.model";
import { User } from "../user/user.model";
import { Payment, PaymentMethod } from "./payment.model";

type Actor = { id: string; role: Role };

type ListInput = {
  userId: string;
  status: "all" | "paid" | "unpaid";
  dateFrom: string;
  dateTo: string;
  search: string;
  page: number;
  limit: number;
  sortBy: "paymentDate" | "amountUsd" | "amountBdt" | "createdAt" | "status";
  sortDir: "asc" | "desc";
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sameMoney = (left: unknown, right: unknown) => money(left).eq(money(right));

const snapshot = (payment: {
  _id: { toString(): string };
  userId: { toString(): string };
  method: string;
  amountUsd: unknown;
  rateBdt: unknown;
  amountBdt: unknown;
  paymentDate: Date;
  note: string;
  status: string;
  paidAt?: Date | null;
  paidById?: { toString(): string } | null;
}) => ({
  id: payment._id.toString(),
  userId: payment.userId.toString(),
  method: payment.method,
  amountUsd: moneyString(payment.amountUsd),
  rateBdt: moneyString(payment.rateBdt),
  amountBdt: moneyString(payment.amountBdt),
  paymentDate: payment.paymentDate,
  note: payment.note,
  status: payment.status,
  paidAt: payment.paidAt ?? null,
  paidById: payment.paidById ? payment.paidById.toString() : null,
});

const ownedUserIds = async (actor: Actor) => {
  if (actor.role === ROLES.SUPER_ADMIN) return null;
  if (actor.role === ROLES.USER) return [new mongoose.Types.ObjectId(actor.id)];
  const users = await User.find({ role: ROLES.USER, createdById: actor.id }).select("_id");
  return users.map((user) => user._id);
};

const assertUserAccess = async (actor: Actor, userId: string) => {
  if (!mongoose.isValidObjectId(userId)) throw new AppError("User not found", 404);
  const user = await User.findOne({ _id: userId, role: ROLES.USER }).select("_id createdById");
  if (!user) throw new AppError("User not found", 404);
  const decision = paymentAccess(actor, {
    id: user._id.toString(),
    createdById: user.createdById ? user.createdById.toString() : null,
  });
  if (decision === "forbid") throw new AppError("You can only view your own payments", 403);
  if (decision === "hide") throw new AppError("User not found", 404);
};

const findAccessiblePayment = async (actor: Actor, id: string) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError("Payment not found", 404);
  const payment = await Payment.findById(id);
  if (!payment) throw new AppError("Payment not found", 404);
  await assertUserAccess(actor, payment.userId.toString());
  return payment;
};

const buildFilter = async (actor: Actor, input: ListInput) => {
  const filter: Record<string, unknown> = {};
  const allowedIds = await ownedUserIds(actor);

  if (actor.role === ROLES.USER) {
    if (input.userId && input.userId !== actor.id) {
      throw new AppError("You can only view your own payments", 403);
    }
    filter.userId = new mongoose.Types.ObjectId(actor.id);
  } else if (input.userId) {
    await assertUserAccess(actor, input.userId);
    filter.userId = new mongoose.Types.ObjectId(input.userId);
  } else if (allowedIds) {
    filter.userId = { $in: allowedIds };
  }

  if (input.status !== "all") filter.status = input.status;
  if (input.dateFrom || input.dateTo) {
    const range: Record<string, Date> = {};
    if (input.dateFrom) {
      const from = new Date(input.dateFrom);
      if (Number.isNaN(from.getTime())) throw new AppError("Invalid start date", 422);
      range.$gte = from;
    }
    if (input.dateTo) {
      const to = new Date(input.dateTo);
      if (Number.isNaN(to.getTime())) throw new AppError("Invalid end date", 422);
      range.$lte = to;
    }
    filter.paymentDate = range;
  }

  if (input.search) {
    const pattern = new RegExp(escapeRegex(input.search), "i");
    const userFilter: Record<string, unknown> = {
      role: ROLES.USER,
      $or: [{ name: pattern }, { email: pattern }],
    };
    if (actor.role === ROLES.ADMIN) userFilter.createdById = actor.id;
    if (actor.role === ROLES.USER) userFilter._id = actor.id;
    const users = await User.find(userFilter).select("_id");
    const userIds = users.map((user) => user._id);
    filter.$or = [{ note: pattern }, { userId: { $in: userIds } }];
  }

  return filter;
};

const presentMany = async (payments: Array<mongoose.HydratedDocument<import("./payment.model").IPayment>>) => {
  const userIds = new Set<string>();
  for (const payment of payments) {
    userIds.add(payment.userId.toString());
    if (payment.paidById) userIds.add(payment.paidById.toString());
  }
  const people = await User.find({ _id: { $in: [...userIds] } }).select("name email");
  const names = new Map(people.map((person) => [person._id.toString(), person]));

  return payments.map((payment) => {
    const user = names.get(payment.userId.toString());
    const payer = payment.paidById ? names.get(payment.paidById.toString()) : undefined;
    return {
      ...snapshot(payment),
      userName: user?.name ?? "Unknown",
      userEmail: user?.email ?? "",
      paidByName: payer?.name ?? null,
    };
  });
};

const totalsFor = async (filter: Record<string, unknown>) => {
  const rows = await Payment.aggregate<{ _id: "paid" | "unpaid"; usd: unknown; bdt: unknown; count: number }>([
    { $match: filter },
    {
      $group: {
        _id: "$status",
        usd: { $sum: "$amountUsd" },
        bdt: { $sum: "$amountBdt" },
        count: { $sum: 1 },
      },
    },
  ]);
  const totals = {
    totalUsd: "0.00",
    totalBdt: "0.00",
    paidUsd: "0.00",
    paidBdt: "0.00",
    unpaidUsd: "0.00",
    unpaidBdt: "0.00",
    count: 0,
  };
  for (const row of rows) {
    totals.totalUsd = addMoney(totals.totalUsd, row.usd);
    totals.totalBdt = addMoney(totals.totalBdt, row.bdt);
    totals.count += row.count;
    if (row._id === "paid") {
      totals.paidUsd = addMoney(totals.paidUsd, row.usd);
      totals.paidBdt = addMoney(totals.paidBdt, row.bdt);
    } else {
      totals.unpaidUsd = addMoney(totals.unpaidUsd, row.usd);
      totals.unpaidBdt = addMoney(totals.unpaidBdt, row.bdt);
    }
  }
  return totals;
};

export const listPayments = async (actor: Actor, input: ListInput) => {
  const filter = await buildFilter(actor, input);
  const total = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .sort({ [input.sortBy]: input.sortDir === "asc" ? 1 : -1 })
    .skip((input.page - 1) * input.limit)
    .limit(input.limit);
  const [rows, totals] = await Promise.all([presentMany(payments), totalsFor(filter)]);
  return {
    payments: rows,
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / input.limit)),
    totals,
  };
};

export const createPayment = async (
  actor: Actor,
  input: { userId: string; method: PaymentMethod; amountUsd: string; rateBdt: string; paymentDate: Date; note: string },
) => {
  if (actor.role === ROLES.USER) throw new AppError("You do not have permission for this action", 403);
  await assertUserAccess(actor, input.userId);
  const payment = await withTransaction(async (session) => {
    const [created] = await Payment.create(
      [
        {
          userId: input.userId,
          method: input.method,
          amountUsd: storedMoney(input.amountUsd),
          rateBdt: storedMoney(input.rateBdt),
          amountBdt: storedMoney(bdtFromUsd(input.amountUsd, input.rateBdt)),
          paymentDate: input.paymentDate,
          note: input.note,
          status: "unpaid",
        },
      ],
      { session },
    );
    await writeAudit(
      {
        actorId: actor.id,
        action: "payment.create",
        entity: "payment",
        entityId: created._id.toString(),
        meta: snapshot(created),
      },
      session,
    );
    return created;
  });
  const [presented] = await presentMany([payment]);
  return presented;
};

export const updatePayment = async (
  actor: Actor,
  id: string,
  input: {
    userId?: string;
    method?: PaymentMethod;
    amountUsd?: string;
    rateBdt?: string;
    paymentDate?: Date;
    note?: string;
  },
) => {
  if (actor.role === ROLES.USER) throw new AppError("You do not have permission for this action", 403);
  const payment = await findAccessiblePayment(actor, id);
  const before = snapshot(payment);
  const amountChanging = input.amountUsd !== undefined && !sameMoney(input.amountUsd, payment.amountUsd);
  const rateChanging = input.rateBdt !== undefined && !sameMoney(input.rateBdt, payment.rateBdt);
  if (payment.status === "paid" && (amountChanging || rateChanging)) {
    throw new AppError("Mark the payment unpaid before changing the amount or rate", 422);
  }
  if (input.userId && input.userId !== payment.userId.toString()) {
    await assertUserAccess(actor, input.userId);
    payment.userId = new mongoose.Types.ObjectId(input.userId);
  }
  if (input.method) payment.method = input.method;
  if (input.paymentDate) payment.paymentDate = input.paymentDate;
  if (input.note !== undefined) payment.note = input.note;
  if (amountChanging || rateChanging) {
    const amountUsd = input.amountUsd ?? payment.amountUsd;
    const rateBdt = input.rateBdt ?? payment.rateBdt;
    payment.amountUsd = storedMoney(amountUsd);
    payment.rateBdt = storedMoney(rateBdt);
    payment.amountBdt = storedMoney(bdtFromUsd(amountUsd, rateBdt));
  }
  await withTransaction(async (session) => {
    await payment.save({ session });
    await writeAudit(
      {
        actorId: actor.id,
        action: "payment.edit",
        entity: "payment",
        entityId: payment._id.toString(),
        meta: { before, after: snapshot(payment) },
      },
      session,
    );
  });
  const [presented] = await presentMany([payment]);
  return presented;
};

export const deletePayment = async (actor: Actor, id: string) => {
  if (actor.role === ROLES.USER) throw new AppError("You do not have permission for this action", 403);
  const payment = await findAccessiblePayment(actor, id);
  const meta = snapshot(payment);
  await withTransaction(async (session) => {
    await payment.deleteOne({ session });
    await writeAudit(
      {
        actorId: actor.id,
        action: "payment.delete",
        entity: "payment",
        entityId: id,
        meta,
      },
      session,
    );
  });
  return { id };
};

const markPaid = async (
  actor: Actor,
  payment: mongoose.HydratedDocument<import("./payment.model").IPayment>,
  session: ClientSession,
) => {
  if (payment.status === "paid") return false;
  payment.status = "paid";
  payment.paidAt = new Date();
  payment.paidById = new mongoose.Types.ObjectId(actor.id);
  await payment.save({ session });
  await writeAudit(
    {
      actorId: actor.id,
      action: "payment.mark_paid",
      entity: "payment",
      entityId: payment._id.toString(),
      meta: { paidAt: payment.paidAt, paidById: actor.id },
    },
    session,
  );
  return true;
};

export const markPaymentPaid = async (actor: Actor, id: string) => {
  if (actor.role === ROLES.USER) throw new AppError("You do not have permission for this action", 403);
  const payment = await findAccessiblePayment(actor, id);
  await withTransaction(async (session) => {
    await markPaid(actor, payment, session);
  });
  const [presented] = await presentMany([payment]);
  return presented;
};

export const markPaymentUnpaid = async (actor: Actor, id: string) => {
  if (actor.role === ROLES.USER) throw new AppError("You do not have permission for this action", 403);
  const payment = await findAccessiblePayment(actor, id);
  if (payment.status === "unpaid") {
    const [presented] = await presentMany([payment]);
    return presented;
  }
  const previous = { paidAt: payment.paidAt ?? null, paidById: payment.paidById ? payment.paidById.toString() : null };
  payment.status = "unpaid";
  payment.paidAt = null;
  payment.paidById = null;
  await withTransaction(async (session) => {
    await payment.save({ session });
    await writeAudit(
      {
        actorId: actor.id,
        action: "payment.mark_unpaid",
        entity: "payment",
        entityId: payment._id.toString(),
        meta: previous,
      },
      session,
    );
  });
  const [presented] = await presentMany([payment]);
  return presented;
};

export const bulkMarkPaymentsPaid = async (actor: Actor, ids: string[]) => {
  if (actor.role === ROLES.USER) throw new AppError("You do not have permission for this action", 403);
  const unique = [...new Set(ids)];
  const payments: Array<mongoose.HydratedDocument<import("./payment.model").IPayment>> = [];
  for (const id of unique) {
    payments.push(await findAccessiblePayment(actor, id));
  }
  const updated = await withTransaction(async (session) => {
    let count = 0;
    for (const payment of payments) {
      if (await markPaid(actor, payment, session)) count += 1;
    }
    return count;
  });
  return { updated, ids: unique };
};
