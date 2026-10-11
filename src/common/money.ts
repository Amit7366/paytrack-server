import Decimal from "decimal.js";
import mongoose from "mongoose";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

const asInput = (value: unknown) => {
  if (value instanceof Decimal) return value;
  if (typeof value === "string" || typeof value === "number") return new Decimal(value);
  if (value && typeof value === "object" && "toString" in value) return new Decimal(String(value));
  throw new Error("Invalid money value");
};

export const money = (value: unknown) => asInput(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const moneyString = (value: unknown) => money(value).toFixed(2);

export const bdtFromUsd = (amountUsd: unknown, rateBdt: unknown) =>
  money(money(amountUsd).mul(money(rateBdt))).toFixed(2);

export const weightedRate = (totalBdt: unknown, totalUsd: unknown) => {
  const usd = asInput(totalUsd);
  if (usd.isZero()) return "0.0000";
  return asInput(totalBdt).div(usd).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
};

export const addMoney = (left: unknown, right: unknown) => money(asInput(left).plus(asInput(right))).toFixed(2);

export const storedMoney = (value: unknown) => mongoose.Types.Decimal128.fromString(moneyString(value));

export const decimalZero = () => mongoose.Types.Decimal128.fromString("0.00");

export const isPositiveMoney = (value: unknown) => {
  try {
    return asInput(value).isFinite() && asInput(value).gt(0);
  } catch {
    return false;
  }
};
