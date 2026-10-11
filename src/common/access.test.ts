import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paymentAccess } from "./access";
import { ROLES } from "./constants/roles";

describe("payment ownership", () => {
  const user = { id: "user-1", createdById: "admin-1" };

  it("lets a super admin see every user", () => {
    assert.equal(paymentAccess({ id: "super", role: ROLES.SUPER_ADMIN }, { ...user, createdById: null }), "allow");
  });

  it("lets an admin see only users they created", () => {
    assert.equal(paymentAccess({ id: "admin-1", role: ROLES.ADMIN }, user), "allow");
    assert.equal(paymentAccess({ id: "admin-2", role: ROLES.ADMIN }, user), "hide");
  });

  it("lets a user see only their own record", () => {
    assert.equal(paymentAccess({ id: "user-1", role: ROLES.USER }, user), "allow");
    assert.equal(paymentAccess({ id: "user-2", role: ROLES.USER }, user), "forbid");
  });
});
