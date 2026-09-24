/**
 * Schema check. Run: npx tsx src/lib/schemas.test.ts
 *
 * Validation is the half of 1.0 that does not exist — every form there fails
 * silently — so the rules that replace it are worth pinning down.
 */
import assert from "node:assert/strict";

import { dialCode } from "./phone";
import {
  companySchema,
  inviteTeammateSchema,
  loginSchema,
  newProjectSchema,
  otpSchema,
  profileSchema,
  signupSchema,
  userInfoSchema,
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
  phone: "2133734253",
  employees: "4",
  revenue: "$500K – $2M",
  enNumber: "",
};

const schema = companySchema("owner@example.com");
assert.ok(schema.safeParse(validCompany).success);

/*
 * EN Number — 1.0's EIN. Optional, because nothing stores it yet: refusing a
 * submit over a value about to be discarded would be the worse failure. Nine
 * digits when it IS filled, so the day the backend grows the column it is not
 * handed a half-typed one.
 */
assert.ok(schema.safeParse({ ...validCompany, enNumber: "123456789" }).success);
assert.equal(
  errorFor(schema.safeParse({ ...validCompany, enNumber: "12345678" }), "enNumber"),
  "An EN Number is nine digits.",
);
assert.equal(
  errorFor(schema.safeParse({ ...validCompany, enNumber: "1234567890" }), "enNumber"),
  "An EN Number is nine digits.",
);

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
// LENGTH IS NOT CHECKED — see the profile section below for why the
// country-aware digit count was removed. Any digits parse, under any country.
assert.ok(schema.safeParse({ ...validCompany, phone: "5550142" }).success);
assert.ok(schema.safeParse({ ...validCompany, phone: "21337342530" }).success);
assert.ok(
  schema.safeParse({ ...validCompany, country: "India", phone: "987654321" })
    .success,
);
// A blank phone still reports as blank, in the same pass as the other blanks.
assert.equal(
  errorFor(schema.safeParse({ ...validCompany, phone: "" }), "phone"),
  "Enter your company phone number.",
);

/* ------------------------------------------------------- user info (1) -- */

// Step 1 carries a country for the dialling code alone — it is not sent
// anywhere, and it no longer decides how many digits the number may have.
const validUserInfo = {
  phone: "2133734253",
  phoneCountry: "United States of America",
  jobTitle: "Company Owner",
};
assert.ok(userInfoSchema.safeParse(validUserInfo).success);
assert.ok(userInfoSchema.safeParse({ ...validUserInfo, phone: "5550142" }).success);
assert.ok(
  userInfoSchema.safeParse({
    ...validUserInfo,
    phoneCountry: "Germany",
    phone: "30123456",
  }).success,
);
// Still required, which never depended on a country.
assert.ok(errorFor(userInfoSchema.safeParse({ ...validUserInfo, phone: "" }), "phone"));

/* ---------------------------------------------------------------- phone -- */

assert.equal(dialCode("United States of America"), "+1");
assert.equal(dialCode("India"), "+91");
// The list carries the backend's codes, not ISO-3166: "UK" and six withdrawn
// codes have to be corrected before libphonenumber will recognise them.
assert.equal(dialCode("United Kingdom"), "+44");
assert.equal(dialCode("Russia"), "+7");
assert.equal(dialCode("Serbia"), "+381");
assert.equal(dialCode("France"), "+33");
assert.equal(dialCode("Benin"), "+229");
assert.equal(dialCode("Burkina Faso"), "+226");
assert.equal(dialCode("Timor-Leste"), "+670");
// A country we cannot look up shows no prefix rather than a wrong one.
assert.equal(dialCode("Atlantis"), "");

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

const validTeammate = {
  email: "tom@example.com",
  firstName: "Tom",
  lastName: "Becker",
  jobTitle: "Office Manager",
  companyIds: ["7"],
};

assert.ok(inviteTeammateSchema.safeParse(validTeammate).success);
// Several companies on one invitation — the whole point of the list.
assert.ok(
  inviteTeammateSchema.safeParse({ ...validTeammate, companyIds: ["7", "9"] })
    .success,
);
assert.ok(
  errorFor(
    inviteTeammateSchema.safeParse({ ...validTeammate, jobTitle: "" }),
    "jobTitle",
  ),
);
// Every box unticked is caught here rather than by the 400 the server would
// answer with — the dialog can say so without sending anything.
assert.equal(
  errorFor(
    inviteTeammateSchema.safeParse({ ...validTeammate, companyIds: [] }),
    "companyIds",
  ),
  "Select at least one company.",
);

/* -------------------------------------------------------------- profile -- */

const validProfile = {
  phone: "2133734253",
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

/*
 * LENGTH IS NO LONGER CHECKED, and these assertions are the record of that.
 *
 * The phone used to be validated against the address country's numbering plan.
 * It was removed (see lib/phone): the country it read was the form's default
 * far more often than the user's own, so it refused correct numbers and
 * accepted wrong ones with equal confidence. Any digits now parse, and the
 * backend's `common.phone` — 7 to 15 digits — is the only bound left.
 */
assert.ok(profileSchema.safeParse({ ...validProfile, phone: "5550142" }).success);
assert.ok(profileSchema.safeParse({ ...validProfile, phone: "987654321" }).success);
assert.ok(profileSchema.safeParse({ ...validProfile, phone: "21337342530" }).success);
// A number stays valid when the country beside it changes — the two are no
// longer tied, which is the whole point of the change.
assert.ok(
  profileSchema.safeParse({
    ...validProfile,
    country: "United Kingdom",
    phone: "2071838750",
  }).success,
);

console.log("schemas: all checks passed");
