/**
 * Shapes and helpers shared by every portal that lists people.
 *
 * The backend returns ONE user shape from its directories (`companyDto
 * .toDirectoryUser`), and four screens were each modelling it differently —
 * admin by email, manager by email, customer by name. They agree here instead.
 */

import { BASE, get } from "@/lib/http";

/** `companyDto.toDirectoryUser`, verbatim. Every people endpoint spreads it. */
export interface DirectoryUser {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string | null;
  specificRole: string | null;
  jobTitle: string | null;
  status: string;
}

/** A company as it appears nested inside a directory row. */
export interface NestedCompany {
  companyId: number;
  companyName: string;
  status?: string;
}

export function fullName(user: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}): string {
  return (
    user.fullName ?? [user.firstName, user.lastName].filter(Boolean).join(" ")
  );
}

/* ------------------------------------------------------------------ roles -- */

export interface SpecificRole {
  specificRoleId: number;
  code: string;
  name: string;
}

export interface RoleCatalog {
  roleId: number;
  code: string;
  name: string;
  requiresSpecificRole: boolean;
  specificRoles: SpecificRole[];
}

/**
 * `POST /invitations` wants `roleId` and `specificRoleId` — numbers from the
 * database, not the role codes the frontend has always spoken in. Nothing
 * fetched them before, so every invite form was posting a name where an id was
 * required.
 *
 * Cached for the life of the process: the catalog is seed data that changes on
 * a migration, and re-fetching it on every keystroke of an invite form is four
 * requests to learn the same four rows.
 */
let catalog: Promise<RoleCatalog[]> | null = null;

export function roles(): Promise<RoleCatalog[]> {
  if (!BASE) return Promise.resolve(MOCK_ROLES);
  catalog ??= get<{ roles: RoleCatalog[] }>("/roles")
    .then((d) => d.roles)
    .catch((err) => {
      // Not cached on failure, or one flaky request disables every invite form
      // for as long as the server runs.
      catalog = null;
      throw err;
    });
  return catalog;
}

/**
 * Resolve a role code — and optionally a specific-role code or display name —
 * into the id pair an invitation needs.
 *
 * `specific` is matched on code first and then on name, because the invite
 * forms show names ("Tax Specialist", "Owner") and the codes they map to
 * (`SPECIALIST_2`, `OWNER`) are not derivable from them.
 */
export async function roleIds(
  code: string,
  specific?: string | null,
): Promise<{ roleId: number; specificRoleId: number | null }> {
  const all = await roles();
  const role = all.find((r) => r.code === code);
  if (!role) throw new Error(`Unknown role: ${code}`);

  if (!role.requiresSpecificRole) return { roleId: role.roleId, specificRoleId: null };

  const match =
    role.specificRoles.find((s) => s.code === specific) ??
    role.specificRoles.find((s) => s.name === specific) ??
    // Only when the caller named nothing. A role that demands a subdivision
    // must be sent one, and the first is the catalog's own default (Owner for a
    // customer, Payroll for a specialist).
    (specific ? null : role.specificRoles[0]);

  // An unmatched name used to fall through to that default, so a form offering
  // a label the catalog does not have created someone in the WRONG role and
  // reported success. Refuse instead — the invite is the record.
  if (!match) throw new Error(`Unknown ${code} role: ${specific}`);

  return { roleId: role.roleId, specificRoleId: match.specificRoleId };
}

/** Mirrors the seed, so invite forms still resolve ids with no backend. */
const MOCK_ROLES: RoleCatalog[] = [
  { roleId: 1, code: "ADMIN", name: "Administrator", requiresSpecificRole: false, specificRoles: [] },
  {
    roleId: 2,
    code: "ACCOUNTING_MANAGER",
    name: "Accounting Manager",
    requiresSpecificRole: false,
    specificRoles: [],
  },
  {
    roleId: 3,
    code: "SPECIALIST",
    name: "Specialist",
    requiresSpecificRole: true,
    specificRoles: [
      { specificRoleId: 3, code: "SPECIALIST_1", name: "Payroll Specialist" },
      { specificRoleId: 4, code: "SPECIALIST_2", name: "Tax Specialist" },
      { specificRoleId: 5, code: "SPECIALIST_3", name: "Bookkeeping Specialist" },
      { specificRoleId: 6, code: "SPECIALIST_4", name: "FP&A Specialist" },
    ],
  },
  {
    roleId: 4,
    code: "CUSTOMER",
    name: "Customer",
    requiresSpecificRole: true,
    specificRoles: [
      { specificRoleId: 1, code: "OWNER", name: "Owner" },
      { specificRoleId: 2, code: "TEAM", name: "Team" },
    ],
  },
];
