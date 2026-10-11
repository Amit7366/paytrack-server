import mongoose from "mongoose";
import { connectDatabase } from "../config/db";
import { bdtFromUsd, storedMoney } from "../common/money";
import { AuditLog } from "../modules/audit/audit-log.model";
import { Payment } from "../modules/payment/payment.model";

const migrate = async () => {
  await connectDatabase();
  const collection = mongoose.connection.collection("payments");
  const legacy = await collection
    .find({ amount: { $exists: true }, amountUsd: { $exists: false } })
    .toArray();

  for (const document of legacy) {
    const currency = document.currency === "BDT" ? "BDT" : "USD";
    const amount = String(document.amount ?? "0");
    const amountUsd = currency === "USD" ? amount : "0.00";
    const amountBdt = currency === "BDT" ? amount : "0.00";
    const rateBdt = currency === "USD" ? "1.00" : "1.00";
    await collection.updateOne(
      { _id: document._id },
      {
        $set: {
          method: document.method ?? "other",
          amountUsd: storedMoney(amountUsd),
          rateBdt: storedMoney(rateBdt),
          amountBdt: storedMoney(currency === "USD" ? bdtFromUsd(amountUsd, rateBdt) : amountBdt),
          paymentDate: document.paymentDate ?? document.createdAt ?? new Date(),
          note: document.note ?? "",
          status: document.status === "paid" ? "paid" : "unpaid",
          paidAt: document.paidAt ?? null,
          paidById: document.paidById ?? null,
        },
        $unset: { amount: "", currency: "" },
      },
    );
  }

  const numeric = await collection
    .find({
      $or: [
        { amountUsd: { $type: "double" } },
        { amountUsd: { $type: "int" } },
        { amountUsd: { $type: "long" } },
      ],
    })
    .toArray();
  for (const document of numeric) {
    const fixed = (value: unknown) => (typeof value === "number" ? value.toFixed(2) : String(value ?? "0"));
    await collection.updateOne(
      { _id: document._id },
      {
        $set: {
          amountUsd: storedMoney(fixed(document.amountUsd)),
          rateBdt: storedMoney(fixed(document.rateBdt)),
          amountBdt: storedMoney(fixed(document.amountBdt)),
        },
      },
    );
  }

  await Payment.syncIndexes();
  await AuditLog.syncIndexes();
  console.log(
    `Migrated ${legacy.length} legacy payment${legacy.length === 1 ? "" : "s"}, converted ${numeric.length} numeric amount${numeric.length === 1 ? "" : "s"} to Decimal128, and synced indexes.`,
  );
  await mongoose.disconnect();
};

migrate().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
