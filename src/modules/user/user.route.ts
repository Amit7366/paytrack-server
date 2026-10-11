import { Router } from "express";
import { ROLES } from "../../common/constants/roles";
import { authenticate } from "../../common/middleware/auth.middleware";
import { authorize } from "../../common/middleware/authorize.middleware";
import { validate } from "../../common/middleware/validate.middleware";
import { getUsers, patchUserRole } from "./user.controller";
import { updateRoleSchema } from "./user.validation";

const router = Router();

router.use(authenticate);

router.get("/", authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), getUsers);
router.patch(
  "/:id/role",
  authorize(ROLES.SUPER_ADMIN),
  validate(updateRoleSchema),
  patchUserRole,
);

export default router;
