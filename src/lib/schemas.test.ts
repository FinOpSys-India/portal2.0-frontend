/**
 * Schema check. Run: npx tsx src/lib/schemas.test.ts
 *
 * Validation is the half of 1.0 that does not exist — every form there fails
 * silently — so the rules that replace it are worth pinning down.
 */
import assert from "node:assert/strict";

import {
  companySchema,
  inviteTeammateSchema,
  loginSchema,
  newProjectSchema,
  otpSchema,
  profileSchema,
  signupSchema,
} from "./schemas";

/** First error message for a field, or undefined if the field passed. */
function errorFor(
  result: { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } },
  field: string,
): string | undefined {
  if (result.success) return undefined;
  return result.error?.issues.find((i) => i.path[0] === field)?.message;
}

const iso = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

/* ---------------------------------------------------------------- login -- */

assert.ok(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success);
assert.equal(
  errorFor(loginSchema.safeParse({ email: "", password: "x" }), "email"),
  "Enter your email address.",
);
assert.equal(
  errorFor(loginSchema.safeParse({ email: "nope", password: "x" }), "email"),
  "Enter a valid email address.",
);

/* --------------------------------------------------------------- signup -- */

// Identity is part of the form: POST /auth/signup requires email, firstName
// and lastName, and the invitation link carries only the token, so they cannot
// be assumed present and have to survive validation.
const signup = {
  email: "invited@example.com",
  firstName: "In",
  lastName: "Vited",
  password: "longenough",
  confirm: "longenough",
};

assert.ok(signupSchema.safeParse(signup).success);

// Each identity field is required — submitting blank would 400 at the backend.
for (const field of ["email", "firstName", "lastName"] as const) {
  assert.ok(
    errorFor(signupSchema.safeParse({ ...signup, [field]: "" }), field),
    `signup must reject an empty ${field}`,
  );
}

// Mismatch must be reported on the confirm field, not the password field.
const mismatch = signupSchema.safeParse({ ...signup, confirm: "different" });
assert.equal(errorFor(mismatch, "confirm"), "Passwords do not match.");
assert.equal(
  errorFor(
    signupSchema.safeParse({ ...signup, password: "short", confirm: "short" }),
    "password",
  ),
  "Use at least 8 characters.",
);

/* ------------------------------------------------------------------ otp -- */

assert.ok(otpSchema.safeParse({ code: "123456" }).success);
assert.equal(errorFor(otpSchema.safeParse({ code: "12345" }), "code"), "The code is 6 digits.");
assert.equal(errorFor(otpSchema.safeParse({ code: "abcdef" }), "code"), "The code is 6 digits.");

/* -------------------------------------------------------------- company -- */

const validCompany = {
  name: "Harbor Coffee Roasters",
  type: "Sole Proprietor",
  addressLine1: "1 Dock St",
  city: "Austin",
  zip: "73301",
  state: "TX",
  country: "United States of America",
  email: "billing@harbor.example.com",
  phone: "5550142",
  employees: "4",
  revenue: "$500K – $2M",
};

const schema = companySchema("owner@example.com");
assert.ok(schema.safeParse(validCompany).success);

// The rule 1.0 enforces silently: company email must differ from the account.
assert.equal(
  errorFor(schema.safeParse({ ...validCompany, email: "owner@example.com" }), "email"),
  "Use a different address from your personal login email.",
);
// Case and surrounding whitespace must not defeat it.
assert.equal(
  errorFor(schema.safeParse({ ...validCompany, email: " OWNER@example.com " }), "email"),
  "Use a different address from your personal login email.",
);
// Too-short phone rejected.
assert.ok(errorFor(schema.safeParse({ ...validCompany, phone: "123" }), "phone"));

/* --------------------------------------------------------- new project -- */

assert.ok(
  newProjectSchema.safeParse({
    name: "August payroll",
    service: "Payroll",
    deadline: iso(1),
  }).success,
);
// Today is not allowed — 1.0 disables it too, it just never says so.
assert.equal(
  errorFor(
    newProjectSchema.safeParse({ name: "x", service: "Payroll", deadline: iso(0) }),
    "deadline",
  ),
  "Pick a date after today.",
);
assert.equal(
  errorFor(
    newProjectSchema.safeParse({ name: "x", service: "Payroll", deadline: iso(-3) }),
    "deadline",
  ),
  "Pick a date after today.",
);

/* ------------------------------------------------------------- teammate -- */

assert.ok(
  inviteTeammateSchema.safeParse({
    email: "tom@example.com",
    firstName: "Tom",
    lastName: "Becker",
    jobTitle: "Office Manager",
  }).success,
);
assert.ok(
  errorFor(
    inviteTeammateSchema.safeParse({
      email: "tom@example.com",
      firstName: "Tom",
      lastName: "Becker",
      jobTitle: "",
    }),
    "jobTitle",
  ),
);

/* -------------------------------------------------------------- profile -- */

const validProfile = {
  phone: "5550142",
  addressLine1: "",
  city: "",
  state: "",
  zip: "",
  country: "United States of America",
};
// Address stays optional: most customers have not filled it in yet.
assert.ok(profileSchema.safeParse(validProfile).success);
assert.ok(errorFor(profileSchema.safeParse({ ...validProfile, phone: "" }), "phone"));
assert.ok(errorFor(profileSchema.safeParse({ ...validProfile, country: "" }), "country"));

console.log("schemas: all checks passed");
