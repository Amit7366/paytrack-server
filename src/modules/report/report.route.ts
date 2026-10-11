import { Router } from "express";
import { ROLES } from "../../common/constants/roles";
import { authenticate } from "../../common/middleware/auth.middleware";
import { authorize } from "../../common/middleware/authorize.middleware";
import { validate } from "../../common/middleware/validate.middleware";
import { getByUser, getExport, getSummary, getUserReport } from "./report.controller";
import { byUserReportSchema, exportReportSchema, summaryReportSchema, userReportSchema } from "./report.validation";

const router = Router();

router.use(authenticate);

router.get("/summary", authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), validate(summaryReportSchema), getSummary);
router.get("/by-user", authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), validate(byUserReportSchema), getByUser);
router.get("/export", authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), validate(exportReportSchema), getExport);
router.get("/user/:id", authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER), validate(userReportSchema), getUserReport);

export default router;
