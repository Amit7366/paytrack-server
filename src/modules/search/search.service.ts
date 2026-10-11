import { ROLES, Role } from "../../common/constants/roles";
import { moneyString } from "../../common/money";
import { Payment } from "../payment/payment.model";
import { User } from "../user/user.model";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const searchLedger = async (actor: { id: string; role: Role }, query: string) => {
  const pattern = new RegExp(escapeRegex(query), "i");
  const peopleFilter: Record<string, unknown> = {
    $or: [{ name: pattern }, { email: pattern }],
  };
  if (actor.role === ROLES.ADMIN) {
    peopleFilter.$and = [{ $or: [{ _id: actor.id }, { createdById: actor.id }] }];
  }
  if (actor.role === ROLES.USER) {
    peopleFilter._id = actor.id;
  }

  const people = actor.role === ROLES.USER ? [] : await User.find(peopleFilter).limit(8);
  const users = people.filter((person) => person.role === ROLES.USER);
  const admins = actor.role === ROLES.SUPER_ADMIN ? people.filter((person) => person.role === ROLES.ADMIN) : [];

  const paymentUserFilter: Record<string, unknown> = { role: ROLES.USER };
  if (actor.role === ROLES.ADMIN) paymentUserFilter.createdById = actor.id;
  if (actor.role === ROLES.USER) paymentUserFilter._id = actor.id;
  const visibleUsers = await User.find(paymentUserFilter).select("_id name");
  const names = new Map(visibleUsers.map((person) => [person._id.toString(), person.name]));
  const matchingIds = visibleUsers.filter((person) => pattern.test(person.name)).map((person) => person._id);

  const payments = await Payment.find({
    userId: { $in: visibleUsers.map((person) => person._id) },
    $or: [{ note: pattern }, { userId: { $in: matchingIds } }],
  })
    .sort({ paymentDate: -1 })
    .limit(8);

  return {
    users: users.map((person) => ({ id: person._id.toString(), name: person.name, email: person.email })),
    admins: admins.map((person) => ({ id: person._id.toString(), name: person.name, email: person.email })),
    payments: payments.map((payment) => ({
      id: payment._id.toString(),
      userName: names.get(payment.userId.toString()) ?? "User",
      note: payment.note,
      status: payment.status,
      amountUsd: moneyString(payment.amountUsd),
      amountBdt: moneyString(payment.amountBdt),
    })),
  };
};
