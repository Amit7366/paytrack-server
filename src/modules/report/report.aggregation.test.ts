import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import mongoose from "mongoose";
import { ROLES } from "../../common/constants/roles";
import { bdtFromUsd, storedMoney } from "../../common/money";
import { connectDatabase } from "../../config/db";
import { Payment } from "../payment/payment.model";
import { User } from "../user/user.model";
import { summaryReport } from "./report.service";

describe("report aggregation", () => {
  it("sums Decimal128 amounts into an Asia/Dhaka day bucket", async () => {
    await connectDatabase();
    const admin = await User.findOne({ role: ROLES.ADMIN });
    assert.ok(admin);
    const user = await User.create({
      name: "Aggregation Test",
      email: `agg.${Date.now()}@example.com`,
      password: "TestPass123!",
      role: ROLES.USER,
      createdById: admin._id,
    });
    try {
      await Payment.create({
        userId: user._id,
        method: "zelle",
        amountUsd: storedMoney("10.10"),
        rateBdt: storedMoney("3.00"),
        amountBdt: storedMoney(bdtFromUsd("10.10", "3.00")),
        paymentDate: new Date("2026-10-09T17:00:00.000Z"),
        note: "aggregation",
        status: "unpaid",
      });
      const superAdmin = await User.findOne({ role: ROLES.SUPER_ADMIN });
      assert.ok(superAdmin);
      const report = await summaryReport(
        { id: superAdmin._id.toString(), role: ROLES.SUPER_ADMIN },
        {
          period: "daily",
          from: "2026-10-09",
          to: "2026-10-09",
          status: "all",
          userId: user._id.toString(),
          adminId: "",
        },
      );
      assert.equal(report.totals.totalUsd, "10.10");
      assert.equal(report.totals.totalBdt, "30.30");
      assert.equal(report.totals.averageRate, "3.0000");
      assert.equal(report.series[0]?.label, "2026-10-09");
      assert.equal(report.series[0]?.unpaidBdt, "30.30");
    } finally {
      await Payment.deleteMany({ userId: user._id });
      await User.deleteOne({ _id: user._id });
    }
  });

  after(async () => {
    await mongoose.disconnect();
  });
});
