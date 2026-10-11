import { Router } from "express";
import adminUserRoutes from "../modules/admin/user.route";
import authRoutes from "../modules/auth/auth.route";
import healthRoutes from "../modules/health/health.route";
import paymentRoutes from "../modules/payment/payment.route";
import reportRoutes from "../modules/report/report.route";
import searchRoutes from "../modules/search/search.route";
import superAdminRoutes from "../modules/super-admin/admin.route";
import userRoutes from "../modules/user/user.route";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/super-admin", superAdminRoutes);
router.use("/admin", adminUserRoutes);
router.use("/payments", paymentRoutes);
router.use("/reports", reportRoutes);
router.use("/search", searchRoutes);

export default router;
