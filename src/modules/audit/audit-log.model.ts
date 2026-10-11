import mongoose, { ClientSession, Schema } from "mongoose";

export interface IAuditLog {
  actorId: mongoose.Types.ObjectId;
  action: string;
  entity: string;
  entityId: string;
  meta: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);

export const writeAudit = async (
  entry: {
    actorId: string;
    action: string;
    entity: string;
    entityId: string;
    meta?: Record<string, unknown>;
  },
  session?: ClientSession,
) => {
  await AuditLog.create(
    [
      {
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        meta: entry.meta ?? {},
      },
    ],
    { session },
  );
};
