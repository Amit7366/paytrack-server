import { Router } from "express";
import { ROLES } from "../../common/constants/roles";
import { authenticate } from "../../common/middleware/auth.middleware";
import { authorize } from "../../common/middleware/authorize.middleware";
import { validate } from "../../common/middleware/validate.middleware";
import { getUser, getUsers, patchUser, postUser, removeUser } from "./user.controller";
import { createUserSchema, listUsersSchema, updateUserSchema, userIdSchema } from "./user.validation";

const router = Router();

router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get("/users", validate(listUsersSchema), getUsers);
router.post("/users", validate(createUserSchema), postUser);
router.get("/users/:id", validate(userIdSchema), getUser);
router.patch("/users/:id", validate(updateUserSchema), patchUser);
router.delete("/users/:id", validate(userIdSchema), removeUser);

export default router;
