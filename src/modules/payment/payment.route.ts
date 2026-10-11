import { Router } from "express";
import { ROLES } from "../../common/constants/roles";
import { authenticate } from "../../common/middleware/auth.middleware";
import { authorize } from "../../common/middleware/authorize.middleware";
import { validate } from "../../common/middleware/validate.middleware";
import {
  getPayments,
  patchPayment,
  postBulkMarkPaid,
  postMarkPaid,
  postMarkUnpaid,
  postPayment,
  removePayment,
} from "./payment.controller";
import {
  bulkMarkPaidSchema,
  createPaymentSchema,
  listPaymentsSchema,
  paymentIdSchema,
  updatePaymentSchema,
} from "./payment.validation";

const router = Router();

router.use(authenticate);

router.get("/", authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER), validate(listPaymentsSchema), getPayments);
router.post("/bulk-mark-paid", authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), validate(bulkMarkPaidSchema), postBulkMarkPaid);
router.post("/", authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), validate(createPaymentSchema), postPayment);
router.patch("/:id", authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), validate(updatePaymentSchema), patchPayment);
router.delete("/:id", authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), validate(paymentIdSchema), removePayment);
router.post("/:id/mark-paid", authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), validate(paymentIdSchema), postMarkPaid);
router.post("/:id/mark-unpaid", authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), validate(paymentIdSchema), postMarkUnpaid);

export default router;
