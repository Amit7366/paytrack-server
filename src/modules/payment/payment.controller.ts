import { Request, Response } from "express";
import { Role } from "../../common/constants/roles";
import { ok } from "../../common/utils/apiResponse";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { PaymentMethod } from "./payment.model";
import {
  bulkMarkPaymentsPaid,
  createPayment,
  deletePayment,
  listPayments,
  markPaymentPaid,
  markPaymentUnpaid,
  updatePayment,
} from "./payment.service";

const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role as Role });

export const getPayments = asyncHandler(async (req: Request, res: Response) => {
  const data = await listPayments(actor(req), req.validated?.query as Parameters<typeof listPayments>[1]);
  res.json(ok("Payments fetched", data));
});

export const postPayment = asyncHandler(async (req: Request, res: Response) => {
  const body = req.validated?.body as {
    userId: string;
    method: PaymentMethod;
    amountUsd: string;
    rateBdt: string;
    paymentDate: Date;
    note: string;
  };
  const payment = await createPayment(actor(req), body);
  res.status(201).json(ok("Payment created", payment));
});

export const patchPayment = asyncHandler(async (req: Request, res: Response) => {
  const id = String((req.validated?.params as { id: string }).id);
  const payment = await updatePayment(actor(req), id, req.validated?.body as Parameters<typeof updatePayment>[2]);
  res.json(ok("Payment updated", payment));
});

export const removePayment = asyncHandler(async (req: Request, res: Response) => {
  const id = String((req.validated?.params as { id: string }).id);
  const result = await deletePayment(actor(req), id);
  res.json(ok("Payment deleted", result));
});

export const postMarkPaid = asyncHandler(async (req: Request, res: Response) => {
  const id = String((req.validated?.params as { id: string }).id);
  const payment = await markPaymentPaid(actor(req), id);
  res.json(ok("Payment marked paid", payment));
});

export const postMarkUnpaid = asyncHandler(async (req: Request, res: Response) => {
  const id = String((req.validated?.params as { id: string }).id);
  const payment = await markPaymentUnpaid(actor(req), id);
  res.json(ok("Payment marked unpaid", payment));
});

export const postBulkMarkPaid = asyncHandler(async (req: Request, res: Response) => {
  const ids = (req.validated?.body as { ids: string[] }).ids;
  const result = await bulkMarkPaymentsPaid(actor(req), ids);
  res.json(ok("Payments marked paid", result));
});
