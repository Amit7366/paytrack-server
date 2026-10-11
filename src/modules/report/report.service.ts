import mongoose from "mongoose";
import { ROLES, Role } from "../../common/constants/roles";
import { AppError } from "../../common/errors/AppError";
import { decimalZero, moneyString, weightedRate } from "../../common/money";
import { Payment } from "../payment/payment.model";
import { User } from "../user/user.model";

type Actor = { id: string; role: Role };
type Period = "daily" | "weekly" | "monthly" | "yearly";
type Status = "all" | "paid" | "unpaid";

const TIMEZONE = "Asia/Dhaka";
const DHAKA_OFFSET = "+06:00";
const EXPORT_LIMIT = 10000;

const emptyTotals = () => ({
  totalUsd: "0.00",
  totalBdt: "0.00",
  paidUsd: "0.00",
  paidBdt: "0.00",
  unpaidUsd: "0.00",
  unpaidBdt: "0.00",
  paymentCount: 0,
  paidCount: 0,
  unpaidCount: 0,
  averageRate: "0.0000",
});

type Totals = ReturnType<typeof emptyTotals>;

type SeriesRow = {
  label: string;
  usd: unknown;
  bdt: unknown;
  paidBdt: unknown;
  unpaidBdt: unknown;
  count: number;
};

type RangeInput = { from: string; to: string; status: Status; userId: string; adminId: string };

const parseBound = (value: string, end: boolean) => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}${DHAKA_OFFSET}`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(end ? "Invalid end date" : "Invalid start date", 422);
  return date;
};

const objectId = (value: string, message: string) => {
  if (!mongoose.isValidObjectId(value)) throw new AppError(message, 404);
  return new mongoose.Types.ObjectId(value);
};

const ownedUserIds = async (actor: Actor, adminId: string) => {
  if (actor.role === ROLES.USER) return [objectId(actor.id, "User not found")];
  if (actor.role === ROLES.ADMIN) {
    if (adminId && adminId !== actor.id) throw new AppError("You can only report on your own users", 403);
    const users = await User.find({ role: ROLES.USER, createdById: actor.id }).select("_id");
    return users.map((user) => user._id);
  }
  if (!adminId) return null;
  const admin = await User.findOne({ _id: adminId, role: ROLES.ADMIN }).select("_id");
  if (!admin) throw new AppError("Admin not found", 404);
  const users = await User.find({ role: ROLES.USER, createdById: admin._id }).select("_id");
  return users.map((user) => user._id);
};

const assertUserAccess = async (actor: Actor, userId: string) => {
  if (actor.role === ROLES.USER) {
    if (actor.id !== userId) throw new AppError("You can only view your own report", 403);
    return;
  }
  const filter: Record<string, unknown> = { _id: userId, role: ROLES.USER };
  if (actor.role === ROLES.ADMIN) filter.createdById = actor.id;
  const user = await User.findOne(filter).select("_id name email");
  if (!user) throw new AppError("User not found", 404);
  return user;
};

const buildMatch = async (actor: Actor, input: RangeInput) => {
  const filter: Record<string, unknown> = {};
  if (input.userId) {
    await assertUserAccess(actor, input.userId);
    filter.userId = objectId(input.userId, "User not found");
  } else {
    const allowed = await ownedUserIds(actor, input.adminId);
    if (allowed) filter.userId = { $in: allowed };
  }
  if (input.status !== "all") filter.status = input.status;
  const from = parseBound(input.from, false);
  const to = parseBound(input.to, true);
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = from;
    if (to) range.$lte = to;
    filter.paymentDate = range;
  }
  return filter;
};

const moneyCond = (status: "paid" | "unpaid", field: string) => ({
  $cond: [{ $eq: ["$status", status] }, field, decimalZero()],
});

const presentTotals = (row?: {
  totalUsd: unknown;
  totalBdt: unknown;
  paidUsd: unknown;
  paidBdt: unknown;
  unpaidUsd: unknown;
  unpaidBdt: unknown;
  paymentCount: number;
  paidCount: number;
  unpaidCount: number;
}): Totals => {
  if (!row) return emptyTotals();
  const totalUsd = moneyString(row.totalUsd);
  const totalBdt = moneyString(row.totalBdt);
  return {
    totalUsd,
    totalBdt,
    paidUsd: moneyString(row.paidUsd),
    paidBdt: moneyString(row.paidBdt),
    unpaidUsd: moneyString(row.unpaidUsd),
    unpaidBdt: moneyString(row.unpaidBdt),
    paymentCount: row.paymentCount,
    paidCount: row.paidCount,
    unpaidCount: row.unpaidCount,
    averageRate: weightedRate(totalBdt, totalUsd),
  };
};

const seriesFormat = (period: Period) => {
  if (period === "yearly") return "%Y";
  if (period === "monthly") return "%Y-%m";
  return "%Y-%m-%d";
};

const seriesPipeline = (period: Period): mongoose.PipelineStage.FacetPipelineStage[] => [
  {
    $group: {
      _id: {
        $dateTrunc: {
          date: "$paymentDate",
          unit: period === "daily" ? "day" : period === "weekly" ? "week" : period === "monthly" ? "month" : "year",
          timezone: TIMEZONE,
          ...(period === "weekly" ? { startOfWeek: "saturday" as const } : {}),
        },
      },
      usd: { $sum: "$amountUsd" },
      bdt: { $sum: "$amountBdt" },
      paidBdt: { $sum: moneyCond("paid", "$amountBdt") },
      unpaidBdt: { $sum: moneyCond("unpaid", "$amountBdt") },
      count: { $sum: 1 },
    },
  },
  { $sort: { _id: 1 } },
  {
    $project: {
      _id: 0,
      label: { $dateToString: { format: seriesFormat(period), date: "$_id", timezone: TIMEZONE } },
      usd: 1,
      bdt: 1,
      paidBdt: 1,
      unpaidBdt: 1,
      count: 1,
    },
  },
];

const presentSeries = (rows: SeriesRow[]) =>
  rows.map((row) => {
    const usd = moneyString(row.usd);
    const bdt = moneyString(row.bdt);
    return {
      label: row.label,
      usd,
      bdt,
      paidBdt: moneyString(row.paidBdt),
      unpaidBdt: moneyString(row.unpaidBdt),
      count: row.count,
      averageRate: weightedRate(bdt, usd),
    };
  });

const totalsGroup = {
  $group: {
    _id: null,
    totalUsd: { $sum: "$amountUsd" },
    totalBdt: { $sum: "$amountBdt" },
    paidUsd: { $sum: moneyCond("paid", "$amountUsd") },
    paidBdt: { $sum: moneyCond("paid", "$amountBdt") },
    unpaidUsd: { $sum: moneyCond("unpaid", "$amountUsd") },
    unpaidBdt: { $sum: moneyCond("unpaid", "$amountBdt") },
    paymentCount: { $sum: 1 },
    paidCount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
    unpaidCount: { $sum: { $cond: [{ $eq: ["$status", "unpaid"] }, 1, 0] } },
  },
};

const aggregateSummary = async (match: Record<string, unknown>, period: Period) => {
  const [result] = await Payment.aggregate<{ totals: Array<Parameters<typeof presentTotals>[0]>; series: SeriesRow[] }>([
    { $match: match },
    {
      $facet: {
        totals: [totalsGroup],
        series: seriesPipeline(period),
      },
    },
  ]);
  return {
    totals: presentTotals(result?.totals[0]),
    series: presentSeries(result?.series ?? []),
  };
};

export const summaryReport = async (
  actor: Actor,
  input: RangeInput & { period: Period },
) => {
  if (actor.role === ROLES.USER) throw new AppError("You do not have permission for this action", 403);
  const match = await buildMatch(actor, input);
  return aggregateSummary(match, input.period);
};

const sortField = (sortBy: "name" | "payments" | "usd" | "bdt" | "paid" | "unpaid") => {
  if (sortBy === "name") return "name";
  if (sortBy === "payments") return "paymentCount";
  if (sortBy === "usd") return "totalUsd";
  if (sortBy === "paid") return "paidBdt";
  if (sortBy === "unpaid") return "unpaidBdt";
  return "totalBdt";
};

type UserRow = {
  userId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  paymentCount: number;
  totalUsd: unknown;
  totalBdt: unknown;
  paidUsd: unknown;
  paidBdt: unknown;
  unpaidUsd: unknown;
  unpaidBdt: unknown;
};

const byUserPipeline = (match: Record<string, unknown>, sortBy: string, sortDir: 1 | -1): mongoose.PipelineStage[] => [
  { $match: match },
  {
    $group: {
      _id: "$userId",
      paymentCount: { $sum: 1 },
      totalUsd: { $sum: "$amountUsd" },
      totalBdt: { $sum: "$amountBdt" },
      paidUsd: { $sum: moneyCond("paid", "$amountUsd") },
      paidBdt: { $sum: moneyCond("paid", "$amountBdt") },
      unpaidUsd: { $sum: moneyCond("unpaid", "$amountUsd") },
      unpaidBdt: { $sum: moneyCond("unpaid", "$amountBdt") },
    },
  },
  { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
  { $unwind: "$user" },
  {
    $project: {
      _id: 0,
      userId: "$_id",
      name: "$user.name",
      email: "$user.email",
      paymentCount: 1,
      totalUsd: 1,
      totalBdt: 1,
      paidUsd: 1,
      paidBdt: 1,
      unpaidUsd: 1,
      unpaidBdt: 1,
    },
  },
  { $sort: { [sortBy]: sortDir, name: 1 } },
];

const presentUserRow = (row: UserRow) => ({
  userId: row.userId.toString(),
  name: row.name,
  email: row.email,
  paymentCount: row.paymentCount,
  totalUsd: moneyString(row.totalUsd),
  totalBdt: moneyString(row.totalBdt),
  paidUsd: moneyString(row.paidUsd),
  paidBdt: moneyString(row.paidBdt),
  unpaidUsd: moneyString(row.unpaidUsd),
  unpaidBdt: moneyString(row.unpaidBdt),
});

export const byUserReport = async (
  actor: Actor,
  input: RangeInput & {
    page: number;
    limit: number;
    sortBy: "name" | "payments" | "usd" | "bdt" | "paid" | "unpaid";
    sortDir: "asc" | "desc";
  },
) => {
  if (actor.role === ROLES.USER) throw new AppError("You do not have permission for this action", 403);
  const match = await buildMatch(actor, input);
  const direction = input.sortDir === "asc" ? 1 : -1;
  const pipeline = byUserPipeline(match, sortField(input.sortBy), direction);
  const [result] = await Payment.aggregate<{ rows: UserRow[]; total: Array<{ count: number }> }>([
    ...pipeline,
    {
      $facet: {
        rows: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
        total: [{ $count: "count" }],
      },
    },
  ]);
  const total = result?.total[0]?.count ?? 0;
  return {
    users: (result?.rows ?? []).map(presentUserRow),
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / input.limit)),
  };
};

export const userReport = async (
  actor: Actor,
  userId: string,
  input: { period: Period; from: string; to: string; status: Status; page: number; limit: number },
) => {
  const user = await assertUserAccess(actor, userId);
  const profile =
    user ??
    (await User.findById(userId).select("name email"));
  if (!profile) throw new AppError("User not found", 404);
  const match = await buildMatch(actor, { ...input, userId, adminId: "" });
  const summary = await aggregateSummary(match, input.period);
  const total = await Payment.countDocuments(match);
  const payments = await Payment.find(match)
    .sort({ paymentDate: -1 })
    .skip((input.page - 1) * input.limit)
    .limit(input.limit);
  return {
    user: { id: profile._id.toString(), name: profile.name, email: profile.email },
    totals: summary.totals,
    series: summary.series,
    payments: payments.map((payment) => ({
      id: payment._id.toString(),
      method: payment.method,
      amountUsd: moneyString(payment.amountUsd),
      rateBdt: moneyString(payment.rateBdt),
      amountBdt: moneyString(payment.amountBdt),
      paymentDate: payment.paymentDate,
      status: payment.status,
      note: payment.note,
      paidAt: payment.paidAt ?? null,
    })),
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / input.limit)),
  };
};

const csvCell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const csvTable = (headers: string[], rows: Array<Array<string | number | null>>) =>
  [headers.join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");

export const exportReport = async (
  actor: Actor,
  input: RangeInput & {
    type: "summary" | "by-user" | "payments";
    period: Period;
    sortBy: "name" | "payments" | "usd" | "bdt" | "paid" | "unpaid";
    sortDir: "asc" | "desc";
  },
) => {
  if (actor.role === ROLES.USER) throw new AppError("You do not have permission for this action", 403);
  const match = await buildMatch(actor, input);
  if (input.type === "summary") {
    const summary = await aggregateSummary(match, input.period);
    const totals = csvTable(
      ["metric", "value"],
      Object.entries(summary.totals).map(([metric, value]) => [metric, value]),
    );
    const series = csvTable(
      ["label", "usd", "bdt", "paidBdt", "unpaidBdt", "count"],
      summary.series.map((row) => [row.label, row.usd, row.bdt, row.paidBdt, row.unpaidBdt, row.count]),
    );
    return { filename: "report-summary.csv", body: `${totals}\n\n${series}\n` };
  }
  if (input.type === "by-user") {
    const direction = input.sortDir === "asc" ? 1 : -1;
    const rows = await Payment.aggregate<UserRow>([
      ...byUserPipeline(match, sortField(input.sortBy), direction),
      { $limit: EXPORT_LIMIT },
    ]);
    return {
      filename: "report-by-user.csv",
      body: `${csvTable(
        ["name", "email", "paymentCount", "totalUsd", "totalBdt", "paidUsd", "paidBdt", "unpaidUsd", "unpaidBdt"],
        rows.map((row) => {
          const presented = presentUserRow(row);
          return [
            presented.name,
            presented.email,
            presented.paymentCount,
            presented.totalUsd,
            presented.totalBdt,
            presented.paidUsd,
            presented.paidBdt,
            presented.unpaidUsd,
            presented.unpaidBdt,
          ];
        }),
      )}\n`,
    };
  }
  const count = await Payment.countDocuments(match);
  if (count > EXPORT_LIMIT) throw new AppError("Narrow the date range before exporting", 422);
  const payments = await Payment.find(match).sort({ paymentDate: -1 }).limit(EXPORT_LIMIT);
  const people = await User.find({ _id: { $in: payments.map((payment) => payment.userId) } }).select("name email");
  const names = new Map(people.map((person) => [person._id.toString(), person]));
  return {
    filename: "report-payments.csv",
    body: `${csvTable(
      ["date", "user", "email", "method", "usd", "rate", "bdt", "status", "note"],
      payments.map((payment) => {
        const person = names.get(payment.userId.toString());
        return [
          payment.paymentDate.toISOString(),
          person?.name ?? "",
          person?.email ?? "",
          payment.method,
          moneyString(payment.amountUsd),
          moneyString(payment.rateBdt),
          moneyString(payment.amountBdt),
          payment.status,
          payment.note,
        ];
      }),
    )}\n`,
  };
};
