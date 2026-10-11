import mongoose from "mongoose";
import { AppError } from "../../common/errors/AppError";
import { AuditLog } from "./audit-log.model";
import { User } from "../user/user.model";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseBound = (value: string, end: boolean) => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}+06:00`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(end ? "Invalid end date" : "Invalid start date", 422);
  return date;
};

export const listAuditLogs = async (input: {
  actorId: string;
  action: string;
  entity: string;
  search: string;
  from: string;
  to: string;
  page: number;
  limit: number;
}) => {
  const filter: Record<string, unknown> = {};
  if (input.actorId) {
    if (!mongoose.isValidObjectId(input.actorId)) throw new AppError("Actor not found", 404);
    filter.actorId = new mongoose.Types.ObjectId(input.actorId);
  }
  if (input.action) filter.action = input.action;
  if (input.entity) filter.entity = input.entity;
  const from = parseBound(input.from, false);
  const to = parseBound(input.to, true);
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = from;
    if (to) range.$lte = to;
    filter.createdAt = range;
  }
  if (input.search) {
    const pattern = new RegExp(escapeRegex(input.search), "i");
    filter.$or = [{ action: pattern }, { entity: pattern }, { entityId: pattern }];
  }

  const total = await AuditLog.countDocuments(filter);
  const logs = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .skip((input.page - 1) * input.limit)
    .limit(input.limit);
  const actors = await User.find({ _id: { $in: logs.map((log) => log.actorId) } }).select("name email");
  const names = new Map(actors.map((actor) => [actor._id.toString(), actor]));

  return {
    logs: logs.map((log) => {
      const actor = names.get(log.actorId.toString());
      return {
        id: log._id.toString(),
        actorId: log.actorId.toString(),
        actorName: actor?.name ?? "Unknown",
        actorEmail: actor?.email ?? "",
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        meta: log.meta,
        createdAt: log.createdAt,
      };
    }),
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / input.limit)),
  };
};
