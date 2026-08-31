/**
 * Admin portal API boundary.
 *
 * Same contract as lib/api.ts: real shapes and real fetch calls when
 * NEXT_PUBLIC_API_URL is set, an in-file mock otherwise so the pages are
 * navigable today. Mock rows are the actual records captured from the live
 * Bubble app, so the columns are exercised with realistic values — including
 * the messy ones (multi-company customers, unassigned managers, blank
 * billing dates).
 */

import {
  ApiError,
  BASE,
  del,
  get,
  getOrNull,
  pageQuery,
  post,
  put,
} from "@/lib/http";
import { fullName, roleIds, type DirectoryUser } from "@/lib/directory";

export type CustomerRole = "Owner" | "Teammate";

export interface Customer {
  name: string;
  role: CustomerRole;
  email: string;
  companies: string[];
}

export interface CustomerDetail extends Customer {
  position: string;
  phone: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface Specialist {
  name: string;
  speciality: string;
  email: string;
}

export interface AccountingManager {
  name: string;
  email: string;
  companies: string[];
}

export interface Company {
  id: string;
  name: string;
  owner: string;
  activeServices: string[];
  /** Absent until a subscription starts. */
  billingDate: string | null;
  teamMembers: string[];
  accountingManager: string | null;
}

export interface CompanyPlan {
  service: string;
  plan: string;
  amount: string;
}

export interface CompanyDetail extends Company {
  email: string;
  enNumber: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  plans: CompanyPlan[];
}

export interface Page<T> {
  rows: T[];
  total: number;
}

/** An assignable accounting manager, named by the id the write actually takes. */
export interface ManagerOption {
  userId: number;
  name: string;
}

/**
 * The companies page, plus the managers its assign dialog can choose from.
 *
 * They travel together because `GET /admin/company-accounts` returns both in
 * one response. The dropdown used to be filled from `managerOptions()` — a
 * hardcoded fixture — so against a live backend it listed one invented person
 * and never a real manager.
 */
export interface CompanyPage extends Page<Company> {
  managers: ManagerOption[];
}

/**
 * Specialist roles, as `specific_roles` seeds them — NOT as 1.0's invite modal
 * spelled them.
 *
 * 1.0 offered three, one of them misspelled ("Bookkeping"). These strings are
 * matched against the role catalog by name to resolve a `specificRoleId`, so
 * the misspelled one matched nothing and every bookkeeping invite was silently
 * created as the catalog's first entry — a Payroll Specialist. FP&A was missing
 * from the list entirely and could not be invited at all.
 */
export const SPECIALIST_ROLES = [
  "Payroll Specialist",
  "Tax Specialist",
  "Bookkeeping Specialist",
  "FP&A Specialist",
] as const;

export const PAGE_SIZE = 10;

export interface InviteInput {
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
}

/**
 * What an invite call reports back.
 *
 * `emailSent` is false when the record was created but the mail did not go —
 * a 201 either way, so the dialog has to be told the difference.
 */
export interface InviteResult {
  emailSent: boolean;
}

/* ------------------------------------------------------------- adapters -- */

/**
 * The backend rows, and what the tables here have always rendered.
 *
 * There is no `/admin/customers`, `/admin/specialists` or `/admin/companies` —
 * those were invented before the Node service existed. The real API scopes ONE
 * directory per kind of person by the caller's role, so an admin calling
 * `GET /customers` gets every customer and an accounting manager calling the
 * same path gets one company's. The adapters below are the whole difference.
 */

interface CustomerRow extends DirectoryUser {
  fullName: string;
  specificRoleName: string | null;
  companies: { companyId: number; companyName: string }[];
}

interface SpecialistRow extends DirectoryUser {
  fullName: string;
  serviceSpeciality: string | null;
}

interface ManagerRow extends DirectoryUser {
  fullName: string;
  companies: { companyId: number; companyName: string }[];
}

interface AccountRow {
  id: number;
  companyName: string;
  companyEmail: string;
  owner: { firstName: string; lastName: string } | null;
  accountingManager: { firstName: string; lastName: string } | null;
  primaryAddress: BackendAddress | null;
  // `planName` is the tier the company is on. There is no price here — see
  // `company()` below.
  activeServices: { specializationName: string; planName: string | null }[];
  billing: { currentPeriodEnd: string | null } | null;
  teamMembers: {
    owner: Person | null;
    accountingManager: Person | null;
    specialists: Person[];
  };
}

interface Person {
  firstName: string;
  lastName: string;
}

/** See lib/portal.ts — the field is `addressLine1`, not the column name. */
interface BackendAddress {
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

const person = (p: Person | null): string => (p ? fullName(p) : "");

/**
 * The customer's own phone and address, for the admin detail screen.
 *
 * The admin page is a REFLECTION of what the customer entered — phone at
 * onboarding step 1, address later on their own profile page — so it has to
 * read the same record they write. The directory row an admin gets carries
 * neither field: `toCustomerRow` spreads `toDirectoryUser`, which stops at
 * name, email, job title and role.
 *
 * Only `GET /customers/:userId` carries them. It now admits ADMIN unscoped,
 * alongside the accounting manager of a named company.
 *
 * NO `?companyId=`, deliberately. The filter is optional for an admin and
 * sending it would narrow the answer for no gain: it is checked against the
 * companies a customer OWNS, and a CUSTOMER/TEAM user owns none — so the one
 * value this row could supply is exactly the one that turns a teammate's
 * profile into a 404. An admin's scope is every customer either way.
 *
 * The 403 fallback stays. The backend is a separate repo and its deployment is
 * not this one's to control, so a build of it that still refuses an admin must
 * render "—" rather than an error page. 404 falls back for the same reason:
 * a customer the admin may not see and one who does not exist answer alike.
 * Anything else still throws — a 500 must not be quietly rendered as "this
 * person has no phone number".
 */
async function customerProfile(
  row: CustomerRow,
): Promise<{ phone: string | null; address: BackendAddress | null } | null> {
  try {
    const data = await get<{
      customer: { phone: string | null; address: BackendAddress | null };
    }>(`/customers/${row.userId}`);
    return data.customer;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      return null;
    }
    throw err;
  }
}

function toCustomer(row: CustomerRow): Customer {
  return {
    name: fullName(row),
    // OWNER / TEAM is the backend's own vocabulary; the table says Owner /
    // Teammate and has since 1.0.
    role: row.specificRole === "OWNER" ? "Owner" : "Teammate",
    email: row.email,
    companies: (row.companies ?? []).map((c) => c.companyName),
  };
}

function toSpecialist(row: SpecialistRow): Specialist {
  return {
    name: fullName(row),
    speciality: row.serviceSpeciality ?? "",
    email: row.email,
  };
}

function toManager(row: ManagerRow): AccountingManager {
  return {
    name: fullName(row),
    email: row.email,
    companies: (row.companies ?? []).map((c) => c.companyName),
  };
}

function toCompany(row: AccountRow): Company {
  const team = row.teamMembers;
  return {
    // The route param. It was the company EMAIL in the fixtures, which is not
    // something any backend route accepts — every company endpoint is keyed by
    // the numeric id.
    id: String(row.id),
    name: row.companyName,
    owner: person(row.owner),
    activeServices: (row.activeServices ?? []).map((s) => s.specializationName),
    // `currentPeriodEnd` is when the next invoice is raised, which is what the
    // "Billing Date" column has always meant. Null before the first checkout.
    billingDate: row.billing?.currentPeriodEnd
      ? new Date(row.billing.currentPeriodEnd).toLocaleDateString("en-US")
      : null,
    teamMembers: [
      team?.owner,
      team?.accountingManager,
      ...(team?.specialists ?? []),
    ]
      .filter((p): p is Person => Boolean(p))
      .map(person),
    accountingManager: row.accountingManager
      ? person(row.accountingManager)
      : null,
  };
}

const address = (a: BackendAddress | null) => ({
  addressLine1: a?.addressLine1 ?? "",
  city: a?.city ?? "",
  state: a?.state ?? "",
  zip: a?.postalCode ?? "",
  country: a?.country ?? "",
});

export const adminApi = {
  /**
   * `GET /customers` is NOT unpaginated for an admin. It defaults to
   * `limit: 25`, so requesting it bare returned the first 25 customers and
   * nothing said so — the table then sliced those 25 and reported them as the
   * total, hiding every customer past the 25th behind a pager that claimed
   * there was nothing more.
   */
  async customers(page: number): Promise<Page<Customer>> {
    if (!BASE) return mock.page(CUSTOMERS, page);
    const data = await get<{
      customers: CustomerRow[];
      pagination: { total: number };
    }>(`/customers?${pageQuery(page, PAGE_SIZE)}`);
    return { rows: data.customers.map(toCustomer), total: data.pagination.total };
  },

  /**
   * `GET /customers/:userId` is keyed by user id while every link here carries
   * an email, so the row comes out of the directory the admin may already read
   * and the id comes off it.
   *
   * Narrowed by `?search=`, which the directory matches against email as well
   * as name. Fetching a page and scanning it would find only the customers who
   * happened to land in that page.
   */
  async customer(email: string): Promise<CustomerDetail | null> {
    if (!BASE) return mock.customer(email);
    const data = await get<{ customers: CustomerRow[] }>(
      `/customers?search=${encodeURIComponent(email)}&limit=${PAGE_SIZE}`,
    );
    // `search` is a substring match, so the exact address still has to be picked
    // out of what comes back.
    const found = data.customers.find((c) => c.email === email);
    if (!found) return null;

    const profile = await customerProfile(found);

    return {
      ...toCustomer(found),
      position: found.jobTitle ?? found.specificRoleName ?? "",
      // The customer's own phone (onboarding step 1) and address (their profile
      // page). Blank if the deployed backend predates the ADMIN gate.
      phone: profile?.phone ?? "",
      ...address(profile?.address ?? null),
    };
  },

  async specialists(page: number): Promise<Page<Specialist>> {
    if (!BASE) return mock.page(SPECIALISTS, page);
    const data = await get<{
      specialists: SpecialistRow[];
      pagination: { total: number };
    }>(`/specialists?${pageQuery(page, PAGE_SIZE)}`);
    // `pagination.total`, not the page length — that counted the rows on screen,
    // so the pager always computed exactly one page.
    return { rows: data.specialists.map(toSpecialist), total: data.pagination.total };
  },

  async accountingManagers(page: number): Promise<Page<AccountingManager>> {
    if (!BASE) return mock.page(MANAGERS, page);
    const data = await get<{
      accountingManagers: ManagerRow[];
      pagination: { total: number };
    }>(`/admin/accounting-managers?${pageQuery(page, PAGE_SIZE)}`);
    return {
      rows: data.accountingManagers.map(toManager),
      total: data.pagination.total,
    };
  },

  /**
   * The eligible managers ride along on this response, so the assign control is
   * built from the same request as the rows it sits in. It used to be handed a
   * hardcoded fixture, which live meant a dropdown listing one invented person
   * and never an actual manager.
   */
  async companies(page: number): Promise<CompanyPage> {
    if (!BASE) {
      return { ...(await mock.page(COMPANIES, page)), managers: MANAGER_OPTIONS };
    }
    const data = await get<{
      companies: AccountRow[];
      accountingManagers: ManagerRow[];
      pagination: { total: number };
    }>(`/admin/company-accounts?${pageQuery(page, PAGE_SIZE)}`);
    return {
      rows: data.companies.map(toCompany),
      total: data.pagination.total,
      managers: data.accountingManagers.map((m) => ({
        userId: m.userId,
        name: fullName(m),
      })),
    };
  },

  async company(id: string): Promise<CompanyDetail | null> {
    if (!BASE) return mock.company(id);
    // `data: { company }`, not the row itself. Read a level too high and every
    // field on the page is `undefined` — a company that renders entirely blank
    // rather than erroring.
    //
    // `getOrNull` because an unknown id is a 404 from the backend, and the page
    // above expects `null` so it can call `notFound()`.
    const data = await getOrNull<{ company: AccountRow }>(
      `/companies/${encodeURIComponent(id)}`,
    );
    const row = data?.company;
    if (!row) return null;

    return {
      ...toCompany(row),
      email: row.companyEmail,
      // 1.0's EIN column. The Node schema has no such field, so it stays blank
      // rather than being filled with something that is not an EIN.
      enNumber: "",
      ...address(row.primaryAddress),
      // From `activeServices`, which is what this endpoint carries. The priced
      // `servicePlans` block belongs to the accounting manager's own view
      // (GET /accounting-manager/companies) and is not on an admin's row, so
      // the amount reads "—" instead of a number that was never sent.
      plans: (row.activeServices ?? []).map((s) => ({
        service: s.specializationName,
        plan: s.planName ?? "—",
        amount: "—",
      })),
    };
  },

  /**
   * All three invite calls are ONE endpoint. The per-role invite paths under
   * `/admin` never existed; `POST /invitations` takes a `roleId` pair from
   * `GET /roles`, which nothing used to fetch — the forms were posting a role
   * NAME where an id was required.
   */
  inviteCustomer(input: InviteInput): Promise<InviteResult> {
    if (!BASE) return mock.invited();
    return invite(input, "CUSTOMER", input.role ?? "OWNER");
  },

  inviteSpecialist(input: InviteInput): Promise<InviteResult> {
    if (!BASE) return mock.invited();
    return invite(input, "SPECIALIST", input.role);
  },

  inviteAccountingManager(input: InviteInput): Promise<InviteResult> {
    if (!BASE) return mock.invited();
    return invite(input, "ACCOUNTING_MANAGER", null);
  },

  /**
   * `PUT`, not `POST`, and it names a USER ID.
   *
   * The id comes straight from the dropdown, which is built from the
   * `accountingManagers` block on the companies response — so there is no
   * lookup here at all. It used to resolve a name to an email to an id through
   * two more requests, off a fixture that held neither.
   */
  async assignManager(companyId: string, managerUserId: number): Promise<void> {
    if (!BASE) return mock.ok();
    await put(`/companies/${encodeURIComponent(companyId)}/accounting-manager`, {
      accountingManagerUserId: managerUserId,
    });
  },

  /**
   * Leave a company with no accounting manager.
   *
   * `DELETE`, and it is a separate endpoint from the assign — the backend does
   * not read "unassign" as a PUT with a null id. Both existed all along; the
   * table simply offered neither once a company had a manager, so the ONE write
   * an admin has over a company was a one-way door. A manager who left the
   * company, or was assigned to the wrong account, could not be moved.
   *
   * Consequences worth knowing before clicking: an unmanaged company has nobody
   * on the other side of its chat, so `POST /chat/conversations` answers
   * NO_ACCOUNTING_MANAGER for its customers and specialists until one is
   * assigned again.
   */
  async removeManager(companyId: string): Promise<void> {
    if (!BASE) return mock.ok();
    await del(`/companies/${encodeURIComponent(companyId)}/accounting-manager`);
  },
};

/**
 * Create an invitation, and report whether the invitee was actually emailed.
 *
 * `invitationService.deliver` catches a mail failure on purpose — the row is
 * already written and can be resent — so the request still answers 201 with
 * `emailSent: false` and the invitation left sitting at status PENDING. That
 * flag used to be discarded here, which meant the dialog closed on a success
 * message while nobody had been written to. The invite is only half done at
 * that point, and the admin is the only person who can tell anyone.
 */
async function invite(
  input: InviteInput,
  role: string,
  specific: string | null | undefined,
): Promise<InviteResult> {
  const ids = await roleIds(role, specific);
  const data = await post<{ emailSent?: boolean }>("/invitations", {
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    ...ids,
  });
  // Absent is treated as sent: only the failure path states it explicitly, and
  // warning on every successful invite would train people to ignore it.
  return { emailSent: data.emailSent !== false };
}

/* ---------------------------------------------------------------- mock ---- */

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

/**
 * Fixture data. Invented names on example.com — the domain RFC 2606 reserves
 * for exactly this — so nothing real leaks into the repo or a screenshot.
 *
 * The *shapes* are drawn from the live app, though: a customer who owns two
 * companies, a company with no billing date, companies with no manager yet,
 * and an empty specialist list. Those are the cases the columns have to
 * survive, and tidy fixtures would hide them.
 */
const CUSTOMERS: Customer[] = [
  {
    name: "Maya Reyes",
    role: "Owner",
    email: "maya.reyes@example.com",
    companies: ["Northwind Trading"],
  },
  {
    name: "Tom Becker",
    role: "Teammate",
    email: "tom.becker@example.com",
    companies: ["Harbor Coffee Roasters"],
  },
  {
    name: "Priya Nair",
    role: "Owner",
    email: "priya.nair@example.com",
    // Belongs to two companies — the case the Companies column exists for.
    companies: ["Harbor Coffee Roasters", "Lakeside Dental"],
  },
  {
    name: "Daniel Okafor",
    role: "Owner",
    email: "daniel.okafor@example.com",
    companies: ["Vertex Labs"],
  },
];

// Staff, so the domain is the product's — same as the managers below.
// Specialities come from SPECIALIST_ROLES, misspelling included.
const SPECIALISTS: Specialist[] = [
  {
    name: "Rosa Delgado",
    speciality: "Payroll Specialist",
    email: "rosa.delgado@finopsys.ai",
  },
  {
    name: "Ivan Petrov",
    speciality: "Tax Specialist",
    email: "ivan.petrov@finopsys.ai",
  },
  {
    name: "Nadia Haddad",
    speciality: "Bookkeping Specialist",
    email: "nadia.haddad@finopsys.ai",
  },
];

const MANAGERS: AccountingManager[] = [
  {
    name: "Alex Morgan",
    // Managers are FinOpSys staff, so the domain is the product's on purpose.
    email: "alex.morgan@finopsys.ai",
    companies: ["Harbor Coffee Roasters"],
  },
];

const COMPANIES: Company[] = [
  {
    id: "billing@harborcoffee.example.com",
    name: "Harbor Coffee Roasters",
    owner: "Priya Nair",
    activeServices: ["Bookkeeping", "Payroll", "Taxes"],
    billingDate: "6/08/26",
    teamMembers: ["Priya Nair", "Alex Morgan", "Tom Becker"],
    accountingManager: "Alex Morgan",
  },
  {
    id: "accounts@lakesidedental.example.com",
    name: "Lakeside Dental",
    owner: "Priya Nair",
    activeServices: ["Payroll"],
    // No subscription yet, so no billing date.
    billingDate: null,
    teamMembers: ["Priya Nair"],
    accountingManager: null,
  },
  {
    id: "hello@northwind.example.com",
    name: "Northwind Trading",
    owner: "Maya Reyes",
    activeServices: ["Payroll"],
    billingDate: null,
    teamMembers: ["Maya Reyes"],
    accountingManager: null,
  },
  {
    id: "finance@vertexlabs.example.com",
    name: "Vertex Labs",
    owner: "Daniel Okafor",
    activeServices: ["Bookkeeping"],
    billingDate: "7/01/26",
    // Deliberately larger than the avatar stack shows, so the +N overflow is
    // exercised by the fixtures rather than only appearing in production.
    teamMembers: [
      "Daniel Okafor",
      "Rosa Delgado",
      "Ivan Petrov",
      "Nadia Haddad",
      "Sam Whitfield",
      "Leah Kaplan",
    ],
    accountingManager: null,
  },
];

const mock = {
  async ok(): Promise<void> {
    await delay();
  },

  async invited(): Promise<InviteResult> {
    await delay();
    return { emailSent: true };
  },

  async page<T>(all: T[], page: number): Promise<Page<T>> {
    await delay();
    const start = (page - 1) * PAGE_SIZE;
    return { rows: all.slice(start, start + PAGE_SIZE), total: all.length };
  },

  async customer(email: string): Promise<CustomerDetail | null> {
    await delay();
    const found = CUSTOMERS.find((c) => c.email === email);
    if (!found) return null;
    return {
      ...found,
      position: found.role === "Owner" ? "Company Owner" : "Team Member",
      // 555 numbers are reserved for fiction.
      phone: "5550142",
      // The customer fills these from their own portal; blank until they do.
      addressLine1: "",
      city: "",
      state: "",
      zip: "",
      country: "United States of America",
    };
  },

  async company(id: string): Promise<CompanyDetail | null> {
    await delay();
    const found = COMPANIES.find((c) => c.id === id);
    if (!found) return null;
    return {
      ...found,
      email: found.id,
      enNumber: "",
      addressLine1: "",
      city: "",
      state: "",
      zip: "",
      country: "United States of America",
      plans:
        found.activeServices.length === 3
          ? [
              { service: "Bookkeeping", plan: "Starter", amount: "$99/month" },
              {
                service: "Payroll",
                plan: "2 employees, 3 contractors",
                amount: "$89/month",
              },
              {
                service: "Taxes",
                plan: "$500K – $2M revenue",
                amount: "$125/month",
              },
            ]
          : [{ service: "Payroll", plan: "—", amount: "—" }],
    };
  },
};

/** Mirrors what `/admin/company-accounts` sends alongside the rows. */
const MANAGER_OPTIONS: ManagerOption[] = MANAGERS.map((m, i) => ({
  userId: i + 1,
  name: m.name,
}));
