import { Router } from "express";
import { ROLES } from "../../common/constants/roles";
import { authenticate } from "../../common/middleware/auth.middleware";
import { authorize } from "../../common/middleware/authorize.middleware";
import { validate } from "../../common/middleware/validate.middleware";
import { listAuditLogsSchema } from "../audit/audit.validation";
import { getAdmins, getAuditLogs, getStats, patchAdmin, postAdmin, removeAdmin } from "./admin.controller";
import { createAdminSchema, listAdminsSchema, updateAdminSchema, adminIdSchema } from "./admin.validation";

const router = Router();

router.use(authenticate, authorize(ROLES.SUPER_ADMIN));

router.get("/stats", getStats);
router.get("/audit-logs", validate(listAuditLogsSchema), getAuditLogs);
router.get("/admins", validate(listAdminsSchema), getAdmins);
router.post("/admins", validate(createAdminSchema), postAdmin);
router.patch("/admins/:id", validate(updateAdminSchema), patchAdmin);
router.delete("/admins/:id", validate(adminIdSchema), removeAdmin);

export default router;
