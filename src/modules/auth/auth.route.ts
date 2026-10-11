import { Router } from "express";
import { ROLES } from "../../common/constants/roles";
import { authenticate } from "../../common/middleware/auth.middleware";
import { authorize } from "../../common/middleware/authorize.middleware";
import { loginRateLimit } from "../../common/middleware/login-rate-limit.middleware";
import { validate } from "../../common/middleware/validate.middleware";
import { login, logout, me, patchMe, register } from "./auth.controller";
import { loginSchema, profileSchema, registerSchema } from "./auth.validation";

const router = Router();

router.post("/register", authenticate, authorize(ROLES.SUPER_ADMIN), validate(registerSchema), register);
router.post("/login", validate(loginSchema), loginRateLimit, login);
router.post("/logout", logout);
router.get("/me", authenticate, me);
router.patch("/me", authenticate, validate(profileSchema), patchMe);

export default router;
