/**
 * Company mapping check. Run: npx tsx src/lib/company.test.ts
 *
 * The form speaks labels and the backend speaks enums and decimals, and the
 * onboarding Back button now needs that translation to run BOTH ways. A round
 * trip that loses the company type or drops a revenue band would show someone
 * who went back to fix their address a different company than the one they
 * saved.
 */
import assert from "node:assert/strict";

import type { CompanyRecord } from "./api";
import { ApiError } from "./http";
import {
  applyCompanyFieldErrors,
  COMPANY_TYPE_OPTIONS,
  companyInput,
  companyTypeLabel,
  companyTypeValue,
  companyValues,
  REVENUE_BANDS,
} from "./company";

/* ------------------------------------------------------------------ type -- */

// Every label the form offers survives the trip to the backend and back.
for (const { label } of COMPANY_TYPE_OPTIONS) {
  assert.equal(
    companyTypeLabel(companyTypeValue(label)),
    label,
    `${label} must round-trip`,
  );
}

// An enum the list does not know leaves the select empty rather than guessing —
// the schema then makes the user pick.
assert.equal(companyTypeLabel("PARTNERSHIP_LIMITED_BY_SHARES"), "");

/* --------------------------------------------------------------- company -- */

const saved: CompanyRecord = {
  id: 7,
  companyName: "Harbor Coffee Roasters",
  companyType: "S_CORPORATION",
  companyEmail: "billing@harbor.example.com",
  companyPhone: "2133734253",
  employeeCount: 4,
  // DECIMAL(18,2) on the way out — the floor of the "$500K – $2M" band.
  lastYearRevenue: "500000.00",
  primaryAddress: {
    addressLine1: "1 Dock St",
    city: "Austin",
    state: "TX",
    postalCode: "73301",
    country: "United States of America",
  },
};

const values = companyValues(saved);
assert.equal(values.name, "Harbor Coffee Roasters");
assert.equal(values.type, "S-Corp");
assert.equal(values.revenue, "$500K – $2M");
assert.equal(values.employees, "4");
assert.equal(values.zip, "73301");
assert.equal(values.country, "United States of America");

// What the form would send back is what the backend already holds — reopening
// the step and pressing Continue unchanged must be a no-op, not an edit.
const back = companyInput(values);
assert.equal(back.companyType, saved.companyType);
assert.equal(back.companyPhone, saved.companyPhone);
assert.equal(back.employeeCount, saved.employeeCount);
assert.equal(back.lastYearRevenue, saved.lastYearRevenue);
assert.equal(back.address.postalCode, saved.primaryAddress?.postalCode);
assert.equal(back.address.countryCode, "US");

/* --------------------------------------------------------------- revenue -- */

// Bands are floors, so an exact figure edited in elsewhere still lands in one.
const bandFor = (amount: string) =>
  companyValues({ ...saved, lastYearRevenue: amount }).revenue;
assert.equal(bandFor("0.00"), REVENUE_BANDS[0]);
assert.equal(bandFor("499999.99"), REVENUE_BANDS[0]);
assert.equal(bandFor("500000.0000"), REVENUE_BANDS[1]);
assert.equal(bandFor("1750000.00"), REVENUE_BANDS[1]);
assert.equal(bandFor("2000000.00"), REVENUE_BANDS[2]);
assert.equal(bandFor("42000000.00"), REVENUE_BANDS[3]);
assert.equal(bandFor(""), "");

/* --------------------------------------------------------------- address -- */

// A company row can exist before its address does. Blanks the user can fill,
// not a crash on the screen they were sent to in order to fix something.
const addressless = companyValues({ ...saved, primaryAddress: null });
assert.equal(addressless.addressLine1, "");
// EMPTY, not a default. This used to answer "United States of America", which
// is a value nobody entered — and the phone rule validates against whatever
// this says, so the guess became "Too few digits for United States of America"
// on a record that had never named a country. The select asks instead.
assert.equal(addressless.country, "");

console.log("company: all checks passed");

/* --------------------------------------------------- server field errors -- */

/**
 * A 400 that names fields must land on the boxes that hold them. The names do
 * not match — `postalCode` is `zip` here, and the address arrives flat — so a
 * mapping that drifts silently goes back to showing the summary line alone.
 */
{
  const placed: Array<[string, string]> = [];
  const stray = applyCompanyFieldErrors(
    new ApiError("Required fields are missing.", 400, "VALIDATION_ERROR", {
      companyPhone: "Required.",
      postalCode: "Enter a valid postal code for the selected country.",
      countryCode: "Use a valid 2-letter country code, e.g. US.",
      revenueCurrency: "Use a 3-letter code, e.g. USD.",
    }),
    (field, error) => placed.push([field, error.message]),
  );

  assert.deepEqual(
    placed.map(([field]) => field).sort(),
    ["country", "phone", "zip"],
    "each named field must land on its form box",
  );
  assert.equal(placed.find(([f]) => f === "phone")?.[1], "Required.");
  // Nothing on the form sets the currency, so it stays on the alert.
  assert.equal(stray.length, 1, "unmappable fields are handed back");
  assert.match(stray[0], /^revenueCurrency: /);
}

// Every name companyInput can produce must be mappable, or a rejection about
// it has nowhere to go.
{
  const body = companyInput({
    name: "Nissan",
    enNumber: "",
    type: "Sole Proprietor",
    addressLine1: "Noida",
    city: "Noida",
    state: "Uttar Pradesh",
    zip: "201304",
    country: "India",
    email: "sg@gmail.com",
    phone: "+918887502268",
    employees: "10",
    revenue: "$500K – $2M",
  });

  const placed: string[] = [];
  applyCompanyFieldErrors(
    new ApiError("Required fields are missing.", 400, "VALIDATION_ERROR", {
      ...Object.fromEntries(
        Object.keys(body)
          .filter((k) => k !== "address" && k !== "revenueCurrency")
          .map((k) => [k, "Required."]),
      ),
      ...Object.fromEntries(
        Object.keys(body.address).map((k) => [k, "Required."]),
      ),
    }),
    (field) => placed.push(field),
  );
  assert.equal(placed.length, 12, "every posted field must map to a box");
}

// A failure that is not a field rejection must not be mistaken for one.
assert.deepEqual(
  applyCompanyFieldErrors(new Error("Network down"), () => {
    throw new Error("must not set a field error");
  }),
  [],
);
