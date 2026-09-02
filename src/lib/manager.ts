/**
 * Accounting manager portal API boundary.
 *
 * Walked in the live 1.0 app on 2026-08-01 as accountmanager@finopsys.ai. The
 * shapes below follow that capture — see docs/am-portal.md, screenshots
 * am-01…am-15. Where 1.0 and this port differ the deviation is commented.
 */

import { cache } from "react";

import type { CompanyPlan, CustomerRole } from "@/lib/admin";
import {
  describeFile,
  get,
  getOrNull,
  patch,
  post,
  put,
  putSigned,
  uploadViaSignedUrls,
  type UploadTicket,
} from "@/lib/http";
import { fullName } from "@/lib/directory";
import {
  personName,
  taskStatusCode,
  toAddressFields,
  toChatMessage,
  toClientCompany,
  toClientCompanyDetail,
  toManagedProject,
  toManagerDocument,
  toProjectTask,
  toSpecialistTask,
  type BackendCompany,
  type BackendConversation,
  type BackendDocument,
  type BackendMessage,
  type BackendProject,
  type BackendTask,
} from "@/lib/portal";

export type ProjectStatus = "Not started" | "In progress" | "Completed";

/** Task states, verbatim from 1.0's project-detail task table. */
export type TaskStatus = "To do" | "In progress" | "Completed";

export interface ClientCompany {
  id: string;
  name: string;
  owner: string;
  activeServices: string[];
  /** M/DD/YY. Absent until a subscription starts — 1.0 renders the cell blank. */
  billingDate: string | null;
  teamMembers: string[];
}

/** Everything the Company Information screen shows. */
export interface ClientCompanyDetail extends ClientCompany {
  email: string;
  /** Editable by the manager in 1.0, and by nobody else. */
  enNumber: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  plans: CompanyPlan[];
}

/** A customer of one of the manager's companies. */
export interface ManagerCustomer {
  name: string;
  role: CustomerRole;
  email: string;
  /** A customer can belong to more than one company. */
  companies: string[];
  companyIds: string[];
  position: string;
  phone: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface ManagedProject {
  id: string;
  name: string;
  company: string;
  companyId: string;
  service: string;
  deadline: string;
  status: ProjectStatus;
  specialist: string | null;
  createdBy: string;
  /** 0–100. 1.0 renders a bar plus the number. */
  progress: number;
  createdOn: string;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: TaskStatus;
  deadline: string;
}

export interface Specialist {
  name: string;
  email: string;
  speciality: string;
  /** Projects currently assigned. Drives the workload column. */
  activeProjects: number;
}

/**
 * One service line on a company: who may work it, and who does today.
 *
 * The unit the staffing dialog renders — one dropdown per line — and the unit
 * the write endpoint takes.
 */
export interface StaffingLine {
  /** The backend's own specialization code, e.g. `BOOKKEEPING`. */
  code: string;
  /** Its display name, e.g. `Bookkeeping`. */
  name: string;
  /** The specialist holding this line, or null when nobody does. */
  assigned: number | null;
  options: { userId: number; name: string; email: string }[];
}

/** What the Specialists Detail screen shows beside the task list. */
export interface SpecialistDetail extends Specialist {
  phone: string;
  /** One line, as the detail card renders it. */
  address: string;
  /**
   * Only ever populated for the SIGNED-IN specialist reading their own profile:
   * `avatarUrl` is on `userDto.toMe`, and the directory row a manager reads
   * someone else off does not carry it.
   */
  avatarUrl?: string | null;
}

/**
 * A task on a specialist's plate. Tasks belong to a project, so the project
 * name rides along — across projects the task name alone says nothing about
 * which job it is part of.
 */
export interface SpecialistTask extends ProjectTask {
  project: string;
}

export interface ManagerProfile {
  name: string;
  email: string;
  phone: string;
  /** `userDto.toMe` builds this from the stored key. Null when none is set. */
  avatarUrl: string | null;
}

/** What `POST /projects` needs, in the form's own words. */
export interface NewProjectInput {
  name: string;
  service: string;
  deadline: string;
}

/**
 * A thread with the accounting manager, as the other side sees it.
 *
 * Both the specialist and the customer have exactly one counterparty — their
 * AM — so neither gets a thread list and neither has a conversation id to pass.
 * Shared here because two portals render the same card off it.
 */
export interface ManagerThread {
  /**
   * The thread itself. Carried so the pane can mark it read on open — without
   * an id there was nothing to post a receipt against, and the badge counted
   * messages the reader was looking at.
   */
  id: string | null;
  /** The accounting manager's name. */
  contact: string;
  unread: number;
}

export type Channel = "chat" | "email";

/** Who the manager is talking to. Customers are clients, specialists staff. */
export type Party = "customer" | "specialist";

export interface Conversation {
  id: string;
  companyId: string;
  company: string;
  /** The person on the other end. */
  contact: string;
  channel: Channel;
  party: Party;
  lastMessage: string;
  /** M/DD/YY, same format as deadlines. */
  lastMessageAt: string;
  unread: number;
}

export interface ConversationFilter {
  companyId?: string;
  channel?: Channel;
  party?: Party;
}

/**
 * One message in a chat thread.
 *
 * 1.0's thread shows no times at all, so a reader cannot tell a reply sent an
 * hour ago from one sent last month. `sentAt` is an ISO instant — formatting
 * belongs to the view, which knows the reader's locale.
 */
export interface ChatMessage {
  id: string;
  /** True when the viewer wrote it. Decides the bubble side, and who may delete. */
  mine: boolean;
  body: string;
  sentAt: string;
  /**
   * Files on the message. An ARRAY because the backend sends one and accepts
   * several per message — the old singular field silently discarded everything
   * past the first, and carried no id, so nothing could be downloaded.
   *
   * `id` is what `GET /chat/attachments/:id/download-url` is called with. The
   * bytes live in a private bucket and are never a plain URL: a link rendered
   * up front would have to be signed for every attachment in every message of
   * every page, most of which nobody opens, and would be expired by the time
   * they did.
   */
  attachments: ChatAttachment[];
}

export interface ChatAttachment {
  id: number;
  name: string;
  size: number;
}

/** The four inboxes the Connect page is split into. */
export const INBOXES: { channel: Channel; party: Party; label: string }[] = [
  { channel: "chat", party: "customer", label: "Chat · Customers" },
  { channel: "chat", party: "specialist", label: "Chat · Specialists" },
  { channel: "email", party: "customer", label: "Email · Customers" },
  { channel: "email", party: "specialist", label: "Email · Specialists" },
];

export interface ManagerDocument {
  id: string;
  name: string;
  companyId: string;
  company: string;
  project: string | null;
  owner: string;
  uploadedAt: string;
  /** Bytes. Rendered beneath the file name. */
  size: number;
}

/**
 * Human file size — "200 KB", "4.2 MB".
 *
 * Binary units, one decimal only where it carries information: "16 MB" says
 * as much as "16.0 MB" and reads faster in a column.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;

  const mb = kb / 1024;
  return `${Number(mb.toFixed(1))} MB`;
}

/**
 * Upload ceiling. THE SERVER'S, not the design's.
 *
 * The mockup said 500 MB and this used to agree with it; the backend caps a
 * document at `UPLOAD_MAX_DOCUMENT_BYTES`, which defaults to 25 MB. Anything in
 * between passed the browser check, was issued a signed ticket, had every byte
 * PUT to storage, and was then refused at the confirm step with a 413 — the
 * worst possible order, since the upload appears to run to completion before it
 * fails.
 *
 * ponytail: hardcoded to the backend's default. If a deployment raises
 * `UPLOAD_MAX_DOCUMENT_BYTES`, this has to move with it — the limit is not
 * exposed on any endpoint, so there is nothing to read it from.
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** The same number as prose, for the dialog. */
export const MAX_UPLOAD_LABEL = "25 MB";

/**
 * Extensions the SERVER accepts, mirroring `utils/documentTypes.js`.
 *
 * Shared by every upload control — the documents dialog and the email
 * composer — because they hit the same allowlist. An allowlist narrower than
 * the backend's is invisible: the upload never happens, so nothing logs a
 * rejection.
 */
export const ACCEPTED_UPLOAD_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "txt",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
];

/**
 * What ONE EMAIL may carry across all its attachments, and how many.
 *
 * Both are the server's, from `emailMessageService`: 20 MB total (stricter than
 * the 25 MB per-file cap, because base64 inflates the MIME parts by a third and
 * the SMTP host would refuse the result) and ten files per message from
 * `UPLOAD_MAX_DOCUMENTS_PER_REQUEST`.
 *
 * ponytail: hardcoded like MAX_UPLOAD_BYTES above, for the same reason — no
 * endpoint publishes either number.
 */
export const MAX_EMAIL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const MAX_EMAIL_ATTACHMENTS = 10;
export const MAX_EMAIL_ATTACHMENT_LABEL = "20 MB";

/**
 * The selection rules for an email's attachments, applied to a whole pick.
 *
 * A pure function so the branches are testable without a browser, and generic
 * so the caller gets its `File`s back rather than the structural type this only
 * needs the two fields of.
 *
 * The WHOLE set is re-checked on every add, not just the new files: the total
 * cap is a property of the set, so three individually-legal files can still
 * exceed it together. A refused file is named and the rest of the pick is kept
 * — dropping a valid selection because one file in it was oversized is what
 * makes people re-pick everything.
 *
 * A courtesy, not a control. `POST /emails` re-reads the real sizes out of the
 * bucket and enforces both caps there; anything checked only in a browser is a
 * suggestion.
 */
export function acceptAttachments<T extends { name: string; size: number }>(
  current: T[],
  chosen: T[],
): { files: T[]; refused: string[] } {
  const refused: string[] = [];
  const files = [...current];

  for (const file of chosen) {
    // The same file picked twice is not an error, it is a no-op — the second
    // pick says nothing new about what the message should carry.
    if (files.some((f) => f.name === file.name && f.size === file.size)) {
      continue;
    }
    if (!ACCEPTED_UPLOAD_EXTENSIONS.includes(fileKind(file.name).toLowerCase())) {
      refused.push(`${file.name} is not a supported file type.`);
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      refused.push(
        `${file.name} is ${formatFileSize(file.size)}; the limit is ${MAX_UPLOAD_LABEL}.`,
      );
      continue;
    }
    if (files.length >= MAX_EMAIL_ATTACHMENTS) {
      refused.push(`Only ${MAX_EMAIL_ATTACHMENTS} files fit on one email.`);
      break;
    }
    if (
      files.reduce((sum, f) => sum + f.size, file.size) >
      MAX_EMAIL_ATTACHMENT_BYTES
    ) {
      refused.push(
        `Attachments come to more than ${MAX_EMAIL_ATTACHMENT_LABEL} with ${file.name}.`,
      );
      continue;
    }
    files.push(file);
  }

  return { files, refused };
}

/** Uppercase extension, for the type chip. Files without one show "FILE". */
export function fileKind(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : "FILE";
}

/**
 * Re-attach the company scope to a link.
 *
 * Detail pages are a single record, so the scope does not filter them — but
 * going back must land on the list the reader left, still narrowed.
 */
export function scoped(path: string, companyId?: string): string {
  return companyId
    ? `${path}?company=${encodeURIComponent(companyId)}`
    : path;
}

/**
 * The company every screen reads under: the one on the URL, or the first on the
 * manager's book when the URL carries none.
 *
 * The portal has no "all companies" view — the switcher offers one company at a
 * time — so every page resolves its scope through here before it asks for data.
 * `companies()` is request-cached, so the fallback costs nothing extra.
 *
 * `undefined` only when the manager holds no companies at all.
 */
export async function companyScope(
  companyId?: string,
): Promise<string | undefined> {
  return companyId ?? (await managerApi.companies())[0]?.id;
}

/* ---------------------------------------------------------------- live ---- */

/**
 * THE COMPANY SCOPE PROBLEM, AND WHY THESE FAN OUT.
 *
 * `/projects`, `/tasks` and `/documents` all REQUIRE `?companyId=` — with no
 * exemption, deliberately, so a filter can never become a way to read across
 * accounts. The screens are scoped to one company each, but a few readers here
 * genuinely span the book — the notification bell, the specialist detail's task
 * list, the upload dialog's project list — and those are resolved into the
 * manager's own company list and queried once per company.
 *
 * ponytail: N+1 on those cross-company reads, bounded by how many accounts one
 * manager holds (a handful). Push the fan-out server-side if a manager's book
 * ever makes it the slow part of the page.
 */
/**
 * The manager's book, fetched AT MOST ONCE PER RENDER.
 *
 * Every list in this portal derives its scope from this one call — `scopeIds`
 * and `companyNames` both reach for it, and so does each page and the layout
 * directly. Rendering /manager/projects asked for it SEVEN times: three from the
 * layout's `Promise.all`, four more from the page's. All concurrent, all
 * identical, and each one its own invocation of a Vercel function capped at
 * `maxDuration: 10` (Portal-backend/vercel.json) — a burst that cold-started
 * into `504 FUNCTION_INVOCATION_TIMEOUT` and took the whole portal down with it.
 *
 * `cache` is React's request-scoped memo, so the dedupe lasts exactly one render
 * and never serves one manager's accounts to another. In the client build it
 * compiles to a plain pass-through, which is harmless here: nothing client-side
 * calls this.
 *
 * ponytail: only this call is deduped. The per-company fan-out underneath it
 * (projects, specialists and chat, one request each per company) is still N
 * requests wide — batch endpoints are the fix if a manager's book gets large.
 */
const fetchCompanies = cache(async (): Promise<ClientCompany[]> => {
  const data = await get<{ companies: BackendCompany[] }>(
    "/accounting-manager/companies?limit=100",
  );
  return data.companies.map(toClientCompany);
});

async function scopeIds(companyId?: string): Promise<string[]> {
  if (companyId) return [companyId];
  const companies = await managerApi.companies();
  return companies.map((c) => c.id);
}

/**
 * The per-company project sweep, memoised for the render that asked for it.
 *
 * `specialists()` reads the project list too, for its workload column — so a
 * page that shows both a project table and a specialist picker ran the whole
 * fan-out twice, one request per company each time. Deduping matters more here
 * than the request count suggests: every one of those requests re-loads the
 * caller, re-loads the company and re-checks access before it reads anything,
 * and each of those is a separate round trip to a database on another continent.
 *
 * Same `cache()` as `fetchCompanies` above, and the same limitation: it holds
 * for one server render, which is where the sweep happens. In the browser React
 * does not memoise and each caller fetches for itself.
 */
const fetchProjects = cache(
  async (companyId?: string): Promise<ManagedProject[]> =>
    overCompanies(companyId, async (id) => {
      const data = await get<{ projects: BackendProject[] }>(
        `/projects?companyId=${encodeURIComponent(id)}&limit=100`,
      );
      return data.projects.map(toManagedProject);
    }),
);

async function overCompanies<T>(
  companyId: string | undefined,
  fn: (id: string) => Promise<T[]>,
): Promise<T[]> {
  const ids = await scopeIds(companyId);
  const pages = await Promise.all(ids.map(fn));
  return pages.flat();
}

/**
 * The per-company conversation sweep, on a key React can actually memoise.
 *
 * `conversations()` takes a filter OBJECT, and `cache()` compares arguments by
 * identity — a fresh `{}` at every call site would miss every time and the
 * memoisation would be decoration. Only the company id reaches the backend; the
 * party and channel filters are applied to the result, so the id is the whole
 * key. The layout asks for this on every manager page to put a number on the
 * bell, so it is the single most repeated sweep in the portal.
 */
const fetchConversations = cache(
  async (companyId?: string): Promise<BackendConversation[]> =>
    overCompanies(companyId, async (id) => {
      const data = await get<{ conversations: BackendConversation[] }>(
        `/chat/conversations?companyId=${encodeURIComponent(id)}`,
      );
      return data.conversations;
    }),
);

/** Name lookup for the rows that carry a company id but not its name. */
const companyNames = cache(async function companyNames(): Promise<
  Map<string, string>
> {
  const companies = await managerApi.companies();
  return new Map(companies.map((c) => [c.id, c.name]));
});

/**
 * The people directories, `?companyId=` REQUIRED.
 *
 * `GET /customers` and `GET /specialists` refuse an unscoped read from anyone
 * but an admin — `companyService.listCustomerDirectory` and its specialist twin
 * both answer `400 companyId is required.` A manager is not an admin, so every
 * bare call from this portal was a 400: the two list screens on first load, and
 * the by-email lookups behind every detail page and both assignment writes.
 *
 * So they are asked per company and merged, the way the projects, documents and
 * conversation lists already are. De-duplicated by user, because a customer on
 * three of the manager's companies is one person and comes back from all three.
 */
const directory = cache(async function directory(
  kind: "customers" | "specialists",
  companyId?: string,
): Promise<ScopedDirectoryRow[]> {
  const rows = await overCompanies(companyId, async (id) => {
    const data = await get<Partial<Record<typeof kind, DirectoryRow[]>>>(
      `/${kind}?companyId=${encodeURIComponent(id)}&limit=${DIRECTORY_LIMIT}`,
    );
    // WHICH company this row was read from, kept because the DETAIL endpoints
    // demand it too and there is no other way back to it. `GET /customers/:id`
    // and `GET /specialists/:id` both answer `400 companyId is required.` to
    // anyone but an admin (companyService.getCustomerDetail /
    // getSpecialistDetail), so a bare lookup was a 400 on every detail page —
    // the same trap the list calls above already work around. Dropping it here
    // is what made the detail calls unable to comply.
    return (data[kind] ?? []).map((row) => ({ ...row, scopeCompanyId: id }));
  });
  return [...new Map(rows.map((row) => [row.userId, row])).values()];
});

/**
 * ponytail: 100 is the directories' own maxLimit and one page is fetched per
 * company, so a company with more than 100 people loses the remainder silently.
 * Page it (as the admin lists do) if an account ever gets that big.
 */
const DIRECTORY_LIMIT = 100;

interface DirectoryRow {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  jobTitle: string | null;
  specificRole: string | null;
  specificRoleName?: string | null;
  serviceSpeciality?: string | null;
  phone?: string | null;
  address?: Parameters<typeof toAddressFields>[0];
  companies?: { companyId: number; companyName: string }[];
}

/** One line of `GET /companies/:id/specialist-options`. */
interface BackendStaffingService {
  specializationCode: string;
  specializationName: string;
  /** At most one, and `userId` is absent when the person record was dropped. */
  assigned: { assignmentId: number | null; userId?: number }[];
  eligibleSpecialists: {
    userId: number;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  }[];
}

/**
 * A directory row plus the company whose roster it came back on.
 *
 * Set by `directory()`, not by the backend. `companies` above is the customer's
 * own multi-company list and is absent on the specialist rows, so it cannot
 * serve as this. Required rather than optional so the detail calls that need it
 * cannot forget it.
 */
type ScopedDirectoryRow = DirectoryRow & { scopeCompanyId: string };

function toManagerCustomer(row: DirectoryRow): ManagerCustomer {
  return {
    name: fullName(row),
    role: row.specificRole === "OWNER" ? "Owner" : "Teammate",
    email: row.email,
    companies: (row.companies ?? []).map((c) => c.companyName),
    companyIds: (row.companies ?? []).map((c) => String(c.companyId)),
    position: row.jobTitle ?? row.specificRoleName ?? "",
    phone: row.phone ?? "",
    ...toAddressFields(row.address),
  };
}

export const managerApi = {
  /** The signed-in manager. The session decides who, not the caller. */
  async profile(): Promise<ManagerProfile> {
    const me = await get<{
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      avatarUrl: string | null;
    }>("/users/me");
    return {
      name: fullName(me),
      email: me.email,
      phone: me.phone ?? "",
      avatarUrl: me.avatarUrl ?? null,
    };
  },

  /**
   * The accounts on this manager's book.
   *
   * `limit` is explicit because every other list in this portal is derived from
   * this one — `scopeIds`, `companyNames`, and through them the projects, tasks,
   * documents and conversations. Left at the server's default of 25, an account
   * past the 25th did not merely fall off this list: it disappeared from the
   * whole portal, with nothing anywhere saying so.
   *
   * ponytail: 100 is the endpoint's maxLimit and one page is fetched. A manager
   * holding more than 100 accounts needs real paging here.
   */
  async companies(): Promise<ClientCompany[]> {
    return fetchCompanies();
  },

  /** `data: { company }`, not the row — read a level too high and every field renders empty. */
  async company(id: string): Promise<ClientCompanyDetail | null> {
    const data = await getOrNull<{ company: BackendCompany }>(
      `/companies/${encodeURIComponent(id)}`,
    );
    return data?.company ? toClientCompanyDetail(data.company) : null;
  },

  /** Customers of the manager's companies. Scoped by the header switcher. */
  async customers(companyId?: string): Promise<ManagerCustomer[]> {
    return (await directory("customers", companyId)).map(toManagerCustomer);
  },

  /**
   * `GET /customers/:userId` is keyed by id and every link here carries an
   * email, so the id is resolved through the directory the caller may already
   * read. One extra request, and no invented lookup-by-email route.
   */
  async customer(email: string): Promise<ManagerCustomer | null> {
    const row = (await directory("customers")).find((c) => c.email === email);
    if (!row) return null;

    const detail = await get<{ customer: DirectoryRow }>(
      `/customers/${row.userId}?companyId=${encodeURIComponent(row.scopeCompanyId)}`,
    );
    return toManagerCustomer({ ...row, ...detail.customer });
  },

  async tasks(projectId: string): Promise<ProjectTask[]> {
    // ponytail: 100 is the task list's maxLimit, fetched in one page so the
    // panel can render the whole breakdown. Page it past that.
    const data = await get<{ tasks: BackendTask[] }>(
      `/projects/${encodeURIComponent(projectId)}/tasks?limit=100`,
    );
    return data.tasks.map(toProjectTask);
  },

  /**
   * `POST /tasks`, not a nested project route, and the project id travels in
   * the body. A description is REQUIRED — the column is NOT NULL — and the
   * deadline must be in the future.
   */
  async addTask(
    projectId: string,
    task: { name: string; description: string; deadline: string },
  ): Promise<void> {
    await post("/tasks", {
      projectId: Number(projectId),
      taskName: task.name,
      description: task.description,
      deadlineDate: task.deadline,
    });
  },

  /** Every project across the companies this manager holds. */
  async projects(companyId?: string): Promise<ManagedProject[]> {
    return fetchProjects(companyId);
  },

  async project(id: string): Promise<ManagedProject | null> {
    const row = await get<BackendProject>(
      `/projects/${encodeURIComponent(id)}`,
    );
    return row ? toManagedProject(row) : null;
  },

  /**
   * Services a project can be opened against, on one of the manager's
   * companies. Derived server-side from what the company actually pays for, so
   * the dropdown can never offer an option the write would refuse.
   */
  async availableServices(companyId: string): Promise<string[]> {
    return (await serviceOptions(companyId)).map((s) => s.serviceName);
  },

  /**
   * Open a project on one of the manager's companies.
   *
   * `POST /projects` has always admitted an ACCOUNTING_MANAGER — its gate reads
   * `requireRole('ACCOUNTING_MANAGER', 'CUSTOMER')` — and this portal simply had
   * no way to call it. The manager could route, staff and task a project, and
   * could not open one, so every job had to start on the client's side of the
   * account.
   *
   * The specialist is NOT chosen here: the server derives it from the company's
   * staffing for that service line, which is what `assignSpecialist` above
   * manipulates.
   */
  async createProject(
    companyId: string,
    input: NewProjectInput,
  ): Promise<ManagedProject> {
    return toManagedProject(await createProjectOn(companyId, input));
  },

  /**
   * Specialists. Scoped by company through assignment — a specialist belongs to
   * no company directly, so "on this company" means "assigned to a service line
   * of theirs".
   */
  async specialists(companyId?: string): Promise<Specialist[]> {
    const [rows, projects] = await Promise.all([
      directory("specialists", companyId),
      managerApi.projects(companyId),
    ]);

    // The workload column. The directory says who they are; only the project
    // list says how much they are carrying.
    const load = new Map<string, number>();
    for (const p of projects) {
      if (p.specialist) load.set(p.specialist, (load.get(p.specialist) ?? 0) + 1);
    }

    return rows.map((row) => ({
      name: fullName(row),
      email: row.email,
      speciality: row.serviceSpeciality ?? "",
      activeProjects: load.get(fullName(row)) ?? 0,
    }));
  },

  /**
   * One specialist, read on the company in view — the same scope the list that
   * links here is under, so the workload figure beside their name counts the
   * projects this company can see and not their whole book.
   */
  async specialist(
    email: string,
    companyId?: string,
  ): Promise<SpecialistDetail | null> {
    const [list, rows] = await Promise.all([
      managerApi.specialists(companyId),
      directory("specialists", companyId),
    ]);
    const row = rows.find((s) => s.email === email);
    const summary = list.find((s) => s.email === email);
    if (!row || !summary) return null;

    const detail = await get<{ specialist: DirectoryRow }>(
      `/specialists/${row.userId}?companyId=${encodeURIComponent(row.scopeCompanyId)}`,
    );
    const a = detail.specialist.address;
    const address = toAddressFields(a);

    return {
      ...summary,
      phone: detail.specialist.phone ?? "",
      // The detail card renders one line, not a block.
      address: [address.addressLine1, address.city, address.state, address.zip]
        .filter(Boolean)
        .join(", "),
    };
  },

  /**
   * Every task this specialist is carrying ON ONE COMPANY.
   *
   * There is no per-specialist task route. `GET /tasks` takes a
   * `specialistUserId` filter, which is the same question asked the way the API
   * asks it.
   *
   * SCOPED, like every other list in this portal. Unscoped it swept the
   * manager's whole book, so a specialist working three accounts showed all
   * three companies' tasks on a screen sitting inside one — rows naming projects
   * that are not on the Projects list two clicks away.
   *
   * `specialistUserId`, NOT `assignedSpecialistUserId`. The two filters are one
   * word apart and live on different endpoints — the longer name is the projects
   * list's. Every task query validator calls `rejectUnknown`, so sending the
   * wrong one here was not ignored: it was a 400 on every specialist detail page.
   */
  async specialistTasks(
    email: string,
    companyId?: string,
  ): Promise<SpecialistTask[]> {
    const row = (await directory("specialists", companyId)).find(
      (s) => s.email === email,
    );
    if (!row) return [];

    return overCompanies(companyId, async (id) => {
      const page = await get<{ tasks: BackendTask[] }>(
        `/tasks?companyId=${encodeURIComponent(id)}&specialistUserId=${row.userId}&limit=100`,
      );
      return page.tasks.map(toSpecialistTask);
    });
  },


  /** `PATCH`, and the status is the backend's own code, not the label. */
  async setTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    await patch(`/tasks/${encodeURIComponent(taskId)}/status`, {
      status: taskStatusCode(status),
    });
  },

  /*
   * No per-project assignment. A specialist is staffed onto a COMPANY's service
   * line — one speciality each, picked when admin invites them — and a project's
   * specialist is derived from that line. Routing a single project meant
   * restaffing the whole line behind the reader's back: every other project on
   * that service moved with it.
   */

  /**
   * The staffing picker for one company, as the SERVER sees it.
   *
   * Three things the client must not decide, and each of them was wrong when it
   * did: WHICH services are active (the company row's `activeServices` labels
   * are not the subscription the write endpoint checks), WHO may work each one
   * (`PUT` refuses a specialist whose specific role does not match the service —
   * a Tax Specialist on bookkeeping is access to books they are not qualified
   * for), and WHO holds the line today. `GET /companies/:id/specialist-options`
   * answers all three, and the write re-checks the same rules, so the picker
   * cannot offer a choice the save would reject.
   */
  async staffing(companyId: string): Promise<StaffingLine[]> {
    const data = await get<{ services: BackendStaffingService[] }>(
      `/companies/${encodeURIComponent(companyId)}/specialist-options`,
    );

    return data.services.map((service) => ({
      code: service.specializationCode,
      name: service.specializationName,
      // `assigned` is at most one per line — it is read from the company's
      // standing specialist column, which is what "exactly one" means there.
      assigned: service.assigned[0]?.userId ?? null,
      options: service.eligibleSpecialists
        .filter((user) => user.status === "ACTIVE")
        .map((user) => ({
          userId: user.userId,
          name: fullName(user),
          email: user.email,
        })),
    }));
  },

  /**
   * Staff a company's service lines — 1.0's only assignment surface.
   *
   * `PUT` states the WHOLE staffing, and the backend insists on it: it answers
   * `422 INCOMPLETE_SPECIALIST_ASSIGNMENTS` unless there is exactly one
   * specialist for every active service. A dialog that submitted only the lines
   * the reader touched therefore saved nothing at all, which is what "it does
   * not save" was.
   *
   * User ids, not emails. The picker already carries them, so nothing has to be
   * resolved through a roster that — by definition on a first assignment — does
   * not have the person on it yet.
   */
  async assignCompanySpecialists(
    companyId: string,
    byService: Record<string, number>,
  ): Promise<void> {

    await put(`/companies/${encodeURIComponent(companyId)}/specialists`, {
      assignments: Object.entries(byService).map(([code, specialistUserId]) => ({
        specializationCode: code,
        specialistUserId,
      })),
    });
    await post("/projects/sync-specialists", { companyId: Number(companyId) });
  },

  /**
   * The Connect inbox.
   *
   * Chat only. There is no email inbox on the backend — `POST /emails` sends
   * and nothing lists what was sent — so an email filter returns nothing rather
   * than inventing rows.
   */
  async conversations(filter: ConversationFilter = {}): Promise<Conversation[]> {
    if (filter.channel === "email") return [];

    const [names, rows] = await Promise.all([
      companyNames(),
      fetchConversations(filter.companyId),
    ]);

    return rows
      .map((c) => ({
        id: String(c.id),
        companyId: String(c.companyId),
        company: c.companyName ?? names.get(String(c.companyId)) ?? "",
        contact: personName(c.counterpart),
        channel: "chat" as Channel,
        // The backend's own word for which side of the account the other person
        // sits on. CUSTOMER covers owner and teammate alike.
        party: (c.participantKind === "SPECIALIST"
          ? "specialist"
          : "customer") as Party,
        lastMessage: c.lastMessage?.body ?? "",
        lastMessageAt: c.lastMessageAt ?? "",
        unread: c.unreadCount ?? 0,
      }))
      .filter((c) => !filter.party || c.party === filter.party)
      // Unread first — the threads owing a reply.
      .sort((a, b) => b.unread - a.unread);
  },

  /**
   * Send an email.
   *
   * `to` is a list of USER IDS, not addresses: the backend resolves the person
   * and reads their address off the joined row, so a client cannot send to
   * somewhere the recipient does not actually live.
   */
  async sendEmail(input: {
    to: string;
    subject: string;
    message: string;
    companyId?: string;
    files?: File[];
  }): Promise<void> {
    await sendEmailAs(input);
  },

  /**
   * Open a thread with one person, or return the existing one.
   *
   * What makes a FIRST message possible. The inbox lists everyone on the
   * company, including people with no thread yet, and this is what those rows
   * call when clicked.
   */
  async openThread(companyId: string, participantUserId: number): Promise<string> {
    return String((await openConversation(companyId, participantUserId)).id);
  },

  /** One thread's messages, oldest first. The API returns newest first. */
  async messages(conversationId: string): Promise<ChatMessage[]> {
    const data = await get<{ messages: BackendMessage[] }>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages?limit=50`,
    );
    // Reversed here rather than server-side: the cursor names the OLDEST row on
    // the page, so sorting there would stop it matching the last element.
    return data.messages.map(toChatMessage).reverse();
  },

  async sendMessage(conversationId: string, body: string): Promise<ChatMessage> {
    // `data` is the stored message itself, same as `openConversation` above.
    const message = await post<BackendMessage>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
      { body },
    );
    return toChatMessage(message);
  },

  /** A file in the thread: ticket, PUT to storage, then the message. */
  sendAttachment(conversationId: string, file: File): Promise<ChatMessage> {
    return sendChatAttachment(conversationId, file);
  },

  /**
   * Attach a file to a company, and optionally to one of its projects.
   *
   * The uploader is the session and is never named by the caller — a client
   * that can name the uploader can name anyone.
   */
  uploadDocument: uploadCompanyDocument,

  /** Documents across the manager's companies, optionally one project's. */
  async documents(
    companyId?: string,
    project?: string,
  ): Promise<ManagerDocument[]> {
    return listDocuments(companyId, project, await companyNames());
  },
};

/* ------------------------------------------------- shared live helpers ---- */

export interface ServiceOption {
  servicePlanId: number;
  serviceName: string;
  serviceCode: string;
}

/**
 * What a company pays for, as the project form's dropdown.
 *
 * Shared with the customer portal rather than written twice: the endpoint has
 * no role gate of its own (only the paywall above it), both portals open
 * projects against the same companies, and the NAME→`servicePlanId` resolution
 * below is the kind of mapping that fails silently when two copies drift.
 */
export async function serviceOptions(
  companyId: string,
): Promise<ServiceOption[]> {
  const data = await get<{ services: ServiceOption[] }>(
    `/projects/services?companyId=${encodeURIComponent(companyId)}`,
  );
  return data.services;
}

/**
 * `POST /projects`, for whichever portal is opening it.
 *
 * The form picks a service by NAME; the endpoint wants the id of that service's
 * base plan, so the option list is read back to resolve it.
 *
 * The created project IS the payload — `data` is the row, not `{ project }`.
 * The controller's own Location header (`${req.baseUrl}/${data.id}`) is the
 * proof. Reading `.project` here yields `undefined`, and the adapter throws on
 * it, so a create would fail AFTER the record had already been written.
 */
export async function createProjectOn(
  companyId: string,
  input: NewProjectInput,
): Promise<BackendProject> {
  const services = await serviceOptions(companyId);
  const service = services.find((s) => s.serviceName === input.service);
  if (!service) {
    throw new Error(`${input.service} is not active on this company.`);
  }

  const project = await post<BackendProject>("/projects", {
    companyId: Number(companyId),
    projectName: input.name,
    deadlineDate: input.deadline,
    servicePlanId: service.servicePlanId,
  });

  /*
   * Route it to whoever holds the company's line for this service.
   *
   * A project's specialist is DERIVED from company staffing, but only when the
   * server is asked to re-derive — `POST /projects` does not do it on the way
   * in. So a company with a bookkeeping specialist still opened every new
   * bookkeeping job unassigned, and someone had to staff by hand what the
   * company-level assignment had already decided.
   *
   * Fire-and-forget on failure: the project exists either way, and re-deriving
   * happens again on the next assignment. Reporting a sync error as a failed
   * create would be a lie.
   */
  await post("/projects/sync-specialists", {
    companyId: Number(companyId),
  }).catch(() => {});

  return project;
}

/**
 * `POST /emails` for any role. Shared because the customer and specialist
 * portals compose through the same form and the same endpoint — only the
 * recipient's side of the account differs, and the server decides that.
 */
export async function sendEmailAs(input: {
  to: string;
  subject: string;
  message: string;
  companyId?: string;
  files?: File[];
}): Promise<void> {
  const companyId = input.companyId ?? (await scopeIds())[0];
  if (!companyId) throw new Error("No company to send from.");

  const to = await recipientId(companyId, input.to);
  const files = await uploadEmailAttachments(companyId, input.files ?? []);

  await post("/emails", {
    companyId: Number(companyId),
    subject: input.subject,
    // The column is HTML. The composer is plain text, so it is escaped rather
    // than passed through — an address with an angle bracket in it would
    // otherwise become markup.
    bodyHtml: `<p>${escapeHtml(input.message).replace(/\n/g, "<br>")}</p>`,
    to: [to],
    // Omitted entirely with nothing attached: `files: []` is accepted, but the
    // no-attachment path is meant to be one request and this keeps it one.
    ...(files.length ? { files } : {}),
  });
}

/**
 * Tickets, then bytes, for the files a message is about to carry.
 *
 * NOT `uploadViaSignedUrls`: the third step of that helper is a confirm call,
 * and an email has none — the send IS the confirm, so this returns the
 * `{ key, fileName }` list for `POST /emails` to carry instead of posting
 * anything itself. There is no draft to hang an upload off, which is why the
 * ticket request names the company rather than a message id.
 *
 * An upload that is never sent leaves an unreferenced object in the bucket.
 * That is the backend's stated trade for not putting file bytes through the
 * API's request-size ceiling, not an oversight here.
 */
async function uploadEmailAttachments(
  companyId: string,
  files: File[],
): Promise<{ key: string; fileName: string }[]> {
  if (!files.length) return [];

  const { uploads } = await post<{ uploads: UploadTicket[] }>(
    "/emails/attachments/upload-url",
    { companyId: Number(companyId), files: files.map(describeFile) },
  );

  await Promise.all(uploads.map((t, i) => putSigned(t.uploadUrl, files[i])));

  return uploads.map((t, i) => ({ key: t.key, fileName: files[i].name }));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * The compose form binds to an email address; `POST /emails` wants a user id.
 *
 * THREE LISTS, not two. The picker is split by which side of the account the
 * person sits on, and the accounting manager is a group of their own — so the
 * manager was reachable through neither of the other two, and the one screen a
 * specialist or a customer has is addressed to exactly them. Both of those
 * portals could compose and never send.
 *
 * `id`, not `userId`: a recipient row is `emailDto.toRecipientOption`, which
 * spreads `projectDto.toPerson` — and that names the column `id`. Reading
 * `userId` off it produced `undefined`, which `JSON.stringify` turns into a null
 * inside `to: []`, so the send failed validation from EVERY portal rather than
 * just the two missing a list.
 *
 * Each list is fetched with its own catch: the three are gated to different
 * roles (an accounting manager is refused the manager list, and that is correct
 * — they are not their own counterparty), so one 403 must not lose the others.
 */
async function recipientId(companyId: string, email: string): Promise<number> {
  const scope = `companyId=${encodeURIComponent(companyId)}`;
  const list = async <K extends string>(
    path: string,
    key: K,
  ): Promise<{ id: number; email: string }[]> => {
    const data = await get<Partial<Record<K, { id: number; email: string }[]>>>(
      `/emails/recipients/${path}?${scope}`,
    ).catch(() => ({}) as Partial<Record<K, { id: number; email: string }[]>>);
    return data[key] ?? [];
  };

  const groups = await Promise.all([
    list("customers", "customers"),
    list("specialists", "specialists"),
    list("accounting-managers", "accountingManagers"),
  ]);

  const found = groups.flat().find((r) => r.email === email);
  if (!found) throw new Error(`${email} is not on this account.`);
  return found.id;
}

/**
 * The one thread a customer or a specialist has.
 *
 * Neither side gets an inbox: both have exactly one counterparty — the
 * company's accounting manager — so there is no conversation to pick. `POST
 * /chat/conversations` is open-or-return, which is what makes a first message
 * possible at all; a list built from existing conversations could never show a
 * thread nobody had started.
 */
export async function openConversation(
  companyId: string,
  participantUserId?: number,
): Promise<BackendConversation> {
  // The envelope's `data` IS the conversation — this route answers with
  // `dto.toConversation(...)`, not `{ conversation }`. Reading a key off it gave
  // `undefined`, and every portal layout that opens its one thread died on
  // `undefined.id` before rendering anything.
  return post<BackendConversation>("/chat/conversations", {
    companyId: Number(companyId),
    // The manager names who they are opening with; a customer or specialist
    // omits it and the server resolves the company's manager for them.
    ...(participantUserId ? { participantUserId } : {}),
  });
}

/**
 * Chat attachment: ticket, PUT to storage, then a message naming the key.
 *
 * Not `uploadViaSignedUrls` — the third step here is "send a message", not a
 * confirm, and it is the message that makes the file exist in the thread.
 */
export async function sendChatAttachment(
  conversationId: string,
  file: File,
): Promise<ChatMessage> {
  const { uploads } = await post<{
    uploads: { key: string; uploadUrl: string }[];
  }>("/chat/attachments/upload-url", {
    conversationId: Number(conversationId),
    files: [
      {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      },
    ],
  });

  const { putSigned } = await import("@/lib/http");
  await putSigned(uploads[0].uploadUrl, file);

  const message = await post<BackendMessage>(
    `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    { files: [{ key: uploads[0].key, fileName: file.name }] },
  );
  return toChatMessage(message);
}

/**
 * Documents live under a PROJECT, always — there is no company-level upload.
 * The form offers "no project", so one has to be chosen, and the company's
 * first project is it.
 */
export async function uploadCompanyDocument(
  file: File,
  meta: { companyId: string; project: string | null },
): Promise<ManagerDocument> {
  const data = await get<{ projects: BackendProject[] }>(
    `/projects?companyId=${encodeURIComponent(meta.companyId)}&limit=100`,
  );
  const target = meta.project
    ? data.projects.find((p) => p.projectName === meta.project)
    : data.projects[0];

  if (!target) {
    throw new Error(
      meta.project
        ? `No project named ${meta.project} on this company.`
        : "Create a project before uploading files to this company.",
    );
  }

  const result = await uploadViaSignedUrls<{ documents: BackendDocument[] }>(
    `/projects/${target.id}/documents/upload-url`,
    `/projects/${target.id}/documents/confirm`,
    meta.companyId,
    [file],
  );

  return toManagerDocument(
    { ...result.documents[0], project: { id: target.id, projectName: target.projectName } },
    { companyId: meta.companyId, companyName: target.companyName ?? "" },
  );
}

/** `GET /documents?companyId=` per company in scope, optionally one project's. */
export async function listDocuments(
  companyId: string | undefined,
  project: string | undefined,
  names: Map<string, string>,
): Promise<ManagerDocument[]> {
  const ids = companyId ? [companyId] : [...names.keys()];

  const pages = await Promise.all(
    ids.map(async (id) => {
      const data = await get<{ documents: BackendDocument[] }>(
        `/documents?companyId=${encodeURIComponent(id)}&limit=100`,
      );
      return data.documents.map((d) =>
        toManagerDocument(d, {
          companyId: id,
          companyName: names.get(id) ?? "",
        }),
      );
    }),
  );

  const all = pages.flat();
  return project ? all.filter((d) => d.project === project) : all;
}

/** Projects with nobody working them. The manager's queue. */
export function unassigned(projects: ManagedProject[]): ManagedProject[] {
  return projects.filter((p) => p.specialist === null);
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * The divider above a day's messages: Today, Yesterday, then the full date.
 *
 * Whole days are differenced, not 24-hour spans, so a message sent at 11pm is
 * "Yesterday" the next morning rather than "Today". Rounding absorbs the 23-
 * and 25-hour days that daylight saving produces.
 */
export function dayLabel(sentAt: string, now = new Date()): string {
  const date = new Date(sentAt);
  const days = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000,
  );

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Clock time on a message, e.g. "3:42 PM". */
export function messageTime(sentAt: string): string {
  return new Date(sentAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The reverse: an `<input type="date">` value (`2026-09-01`) into 1.0's
 * `9/01/26`. Month unpadded, day padded — that is 1.0's own format, and a row
 * written in one format inside a column of another reads as a bug.
 */
export function toStamp(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${Number(month)}/${day}/${year.slice(2)}`;
}

/** Parses 1.0's M/DD/YY format. Two-digit years are 2000s. */
export function parseDeadline(value: string): Date {
  const [month, day, year] = value.split("/").map(Number);
  return new Date(2000 + year, month - 1, day);
}

/**
 * Unread threads first, then most recent.
 *
 * Dates are parsed rather than string-compared for the same reason deadlines
 * are: "8/03/26" sorts after "7/28/26" as text but before it as a date.
 */
export function sortByUnreadThenRecent(
  conversations: Conversation[],
): Conversation[] {
  return [...conversations].sort((a, b) => {
    if ((a.unread > 0) !== (b.unread > 0)) return a.unread > 0 ? -1 : 1;
    return (
      parseDeadline(b.lastMessageAt).getTime() -
      parseDeadline(a.lastMessageAt).getTime()
    );
  });
}

/** Total unread across threads. Drives the header bell count. */
export function totalUnread(conversations: Conversation[]): number {
  return conversations.reduce((sum, c) => sum + c.unread, 0);
}
