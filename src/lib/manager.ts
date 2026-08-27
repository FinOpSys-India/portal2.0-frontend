/**
 * Accounting manager portal API boundary.
 *
 * Walked in the live 1.0 app on 2026-08-01 as accountmanager@finopsys.ai. The
 * shapes below follow that capture — see docs/am-portal.md, screenshots
 * am-01…am-15. Where 1.0 and this port differ the deviation is commented.
 */

import type { CompanyPlan, CustomerRole } from "@/lib/admin";
import {
  BASE,
  get,
  getOrNull,
  patch,
  post,
  put,
  uploadViaSignedUrls,
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

/** What the Specialists Detail screen shows beside the task list. */
export interface SpecialistDetail extends Specialist {
  phone: string;
  /** One line, as the detail card renders it. */
  address: string;
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

/* ---------------------------------------------------------------- live ---- */

/**
 * THE COMPANY SCOPE PROBLEM, AND WHY THESE FAN OUT.
 *
 * `/projects`, `/tasks` and `/documents` all REQUIRE `?companyId=` — with no
 * exemption, deliberately, so a filter can never become a way to read across
 * accounts. The manager's screens have an "All companies" setting, which has no
 * single company to name. So "all" is resolved into the manager's own list and
 * queried once per company.
 *
 * ponytail: N+1 on the unscoped view, bounded by how many accounts one manager
 * holds (a handful). Push the fan-out server-side if a manager's book ever
 * makes it the slow part of the page.
 */
async function scopeIds(companyId?: string): Promise<string[]> {
  if (companyId) return [companyId];
  const companies = await managerApi.companies();
  return companies.map((c) => c.id);
}

async function overCompanies<T>(
  companyId: string | undefined,
  fn: (id: string) => Promise<T[]>,
): Promise<T[]> {
  const ids = await scopeIds(companyId);
  const pages = await Promise.all(ids.map(fn));
  return pages.flat();
}

/** Name lookup for the rows that carry a company id but not its name. */
async function companyNames(): Promise<Map<string, string>> {
  const companies = await managerApi.companies();
  return new Map(companies.map((c) => [c.id, c.name]));
}

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
async function directory(
  kind: "customers" | "specialists",
  companyId?: string,
): Promise<DirectoryRow[]> {
  const rows = await overCompanies(companyId, async (id) => {
    const data = await get<Partial<Record<typeof kind, DirectoryRow[]>>>(
      `/${kind}?companyId=${encodeURIComponent(id)}&limit=${DIRECTORY_LIMIT}`,
    );
    return data[kind] ?? [];
  });
  return [...new Map(rows.map((row) => [row.userId, row])).values()];
}

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
    if (!BASE) return mock.profile();
    const me = await get<{
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
    }>("/users/me");
    return { name: fullName(me), email: me.email, phone: me.phone ?? "" };
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
    if (!BASE) return mock.companies();
    const data = await get<{ companies: BackendCompany[] }>(
      "/accounting-manager/companies?limit=100",
    );
    return data.companies.map(toClientCompany);
  },

  /** `data: { company }`, not the row — read a level too high and every field renders empty. */
  async company(id: string): Promise<ClientCompanyDetail | null> {
    if (!BASE) return mock.company(id);
    const data = await getOrNull<{ company: BackendCompany }>(
      `/companies/${encodeURIComponent(id)}`,
    );
    return data?.company ? toClientCompanyDetail(data.company) : null;
  },

  /** Customers of the manager's companies. Scoped by the header switcher. */
  async customers(companyId?: string): Promise<ManagerCustomer[]> {
    if (!BASE) return mock.customers(companyId);
    return (await directory("customers", companyId)).map(toManagerCustomer);
  },

  /**
   * `GET /customers/:userId` is keyed by id and every link here carries an
   * email, so the id is resolved through the directory the caller may already
   * read. One extra request, and no invented lookup-by-email route.
   */
  async customer(email: string): Promise<ManagerCustomer | null> {
    if (!BASE) return mock.customer(email);
    const row = (await directory("customers")).find((c) => c.email === email);
    if (!row) return null;

    const detail = await get<{ customer: DirectoryRow }>(
      `/customers/${row.userId}`,
    );
    return toManagerCustomer({ ...row, ...detail.customer });
  },

  async tasks(projectId: string): Promise<ProjectTask[]> {
    if (!BASE) return mock.tasks(projectId);
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
    if (!BASE) return mock.addTask(projectId, task);
    await post("/tasks", {
      projectId: Number(projectId),
      taskName: task.name,
      description: task.description,
      deadlineDate: task.deadline,
    });
  },

  /** Every project across the companies this manager holds. */
  async projects(companyId?: string): Promise<ManagedProject[]> {
    if (!BASE) return mock.projects(companyId);
    return overCompanies(companyId, async (id) => {
      const data = await get<{ projects: BackendProject[] }>(
        `/projects?companyId=${encodeURIComponent(id)}&limit=100`,
      );
      return data.projects.map(toManagedProject);
    });
  },

  async project(id: string): Promise<ManagedProject | null> {
    if (!BASE) return mock.project(id);
    const row = await get<BackendProject>(
      `/projects/${encodeURIComponent(id)}`,
    );
    return row ? toManagedProject(row) : null;
  },

  /**
   * Specialists. Scoped by company through assignment — a specialist belongs to
   * no company directly, so "on this company" means "assigned to a service line
   * of theirs".
   */
  async specialists(companyId?: string): Promise<Specialist[]> {
    if (!BASE) return mock.specialists(companyId);
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

  async specialist(email: string): Promise<SpecialistDetail | null> {
    if (!BASE) return mock.specialist(email);
    const [list, rows] = await Promise.all([
      managerApi.specialists(),
      directory("specialists"),
    ]);
    const row = rows.find((s) => s.email === email);
    const summary = list.find((s) => s.email === email);
    if (!row || !summary) return null;

    const detail = await get<{ specialist: DirectoryRow }>(
      `/specialists/${row.userId}`,
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
   * Every task on the projects this specialist holds.
   *
   * There is no per-specialist task route. `GET /tasks` takes a
   * `specialistUserId` filter, which is the same question asked the way the API
   * asks it.
   *
   * `specialistUserId`, NOT `assignedSpecialistUserId`. The two filters are one
   * word apart and live on different endpoints — the longer name is the projects
   * list's. Every task query validator calls `rejectUnknown`, so sending the
   * wrong one here was not ignored: it was a 400 on every specialist detail page.
   */
  async specialistTasks(email: string): Promise<SpecialistTask[]> {
    if (!BASE) return mock.specialistTasks(email);
    const row = (await directory("specialists")).find((s) => s.email === email);
    if (!row) return [];

    return overCompanies(undefined, async (id) => {
      const page = await get<{ tasks: BackendTask[] }>(
        `/tasks?companyId=${encodeURIComponent(id)}&specialistUserId=${row.userId}&limit=100`,
      );
      return page.tasks.map(toSpecialistTask);
    });
  },

  /** `PATCH`, and the status is the backend's own code, not the label. */
  async setTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    if (!BASE) return mock.setTaskStatus(taskId, status);
    await patch(`/tasks/${encodeURIComponent(taskId)}/status`, {
      status: taskStatusCode(status),
    });
  },

  /**
   * Assign a specialist to a project.
   *
   * A project's specialist is DERIVED, not set: the server copies it from the
   * company's staffing for that project's service line. So routing one project
   * means staffing that line, then asking the server to re-derive — which is
   * exactly what `POST /projects/sync-specialists` does.
   */
  async assignSpecialist(
    projectId: string,
    specialistEmail: string,
  ): Promise<void> {
    if (!BASE) return mock.ok();

    const project = await managerApi.project(projectId);
    if (!project) throw new Error("That project no longer exists.");

    const row = await specialistByEmail(specialistEmail);
    const service = await serviceCodeFor(projectId);

    await post(`/companies/${encodeURIComponent(project.companyId)}/specialists`, {
      specialistUserId: row.userId,
      specializationCodes: [service],
    });
    await post("/projects/sync-specialists", {
      companyId: Number(project.companyId),
    });
  },

  /**
   * Assign specialists to a company, one per service — 1.0's only assignment
   * surface. `PUT` replaces the whole set, which is what the dialog submits.
   */
  async assignCompanySpecialists(
    companyId: string,
    byService: Partial<Record<"bookkeeping" | "payroll" | "tax", string>>,
  ): Promise<void> {
    if (!BASE) return mock.ok();

    const entries = Object.entries(byService).filter(
      (e): e is [string, string] => Boolean(e[1]),
    );
    const rows = await Promise.all(
      entries.map(async ([service, email]) => ({
        specializationCode: SERVICE_CODE[service] ?? service.toUpperCase(),
        specialistUserId: (await specialistByEmail(email)).userId,
      })),
    );

    await put(`/companies/${encodeURIComponent(companyId)}/specialists`, {
      assignments: rows,
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
    if (!BASE) return mock.conversations(filter);
    if (filter.channel === "email") return [];

    const names = await companyNames();
    const rows = await overCompanies(filter.companyId, async (id) => {
      const data = await get<{ conversations: BackendConversation[] }>(
        `/chat/conversations?companyId=${encodeURIComponent(id)}`,
      );
      return data.conversations;
    });

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
  }): Promise<void> {
    if (!BASE) return mock.ok();
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
    if (!BASE) return `mock-${participantUserId}`;
    return String((await openConversation(companyId, participantUserId)).id);
  },

  /** One thread's messages, oldest first. The API returns newest first. */
  async messages(conversationId: string): Promise<ChatMessage[]> {
    if (!BASE) return mock.messages(conversationId);
    const data = await get<{ messages: BackendMessage[] }>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages?limit=50`,
    );
    // Reversed here rather than server-side: the cursor names the OLDEST row on
    // the page, so sorting there would stop it matching the last element.
    return data.messages.map(toChatMessage).reverse();
  },

  async sendMessage(conversationId: string, body: string): Promise<ChatMessage> {
    if (!BASE) return mock.sendMessage(conversationId, body);
    const data = await post<{ message: BackendMessage }>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
      { body },
    );
    return toChatMessage(data.message);
  },

  /** A file in the thread: ticket, PUT to storage, then the message. */
  sendAttachment(conversationId: string, file: File): Promise<ChatMessage> {
    if (!BASE) return mock.sendAttachment(conversationId, file);
    return sendChatAttachment(conversationId, file);
  },

  /**
   * Attach a file to a company, and optionally to one of its projects.
   *
   * `owner` is ignored against the real backend — the uploader is the session,
   * because a client that can name the uploader can name anyone.
   */
  async uploadDocument(
    file: File,
    meta: { companyId: string; project: string | null; owner: string },
  ): Promise<ManagerDocument> {
    if (!BASE) return mock.uploadDocument(file, meta);
    return uploadCompanyDocument(file, meta);
  },

  /** Documents across the manager's companies, optionally one project's. */
  async documents(
    companyId?: string,
    project?: string,
  ): Promise<ManagerDocument[]> {
    if (!BASE) return mock.documents(companyId, project);
    return listDocuments(companyId, project, await companyNames());
  },
};

/* ------------------------------------------------- shared live helpers ---- */

/** The dialog's service keys, in the backend's specialization vocabulary. */
const SERVICE_CODE: Record<string, string> = {
  bookkeeping: "BOOKKEEPING",
  payroll: "PAYROLL",
  tax: "TAX",
};

async function specialistByEmail(email: string): Promise<DirectoryRow> {
  const row = (await directory("specialists")).find((s) => s.email === email);
  if (!row) throw new Error(`No specialist for ${email}.`);
  return row;
}

/** Which service line a project sits on — the line that has to be staffed. */
async function serviceCodeFor(projectId: string): Promise<string> {
  const row = await get<BackendProject>(
    `/projects/${encodeURIComponent(projectId)}`,
  );
  const code = row.service?.serviceCode;
  if (!code) throw new Error("That project names no service to staff.");
  return code;
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
}): Promise<void> {
  const companyId = input.companyId ?? (await scopeIds())[0];
  if (!companyId) throw new Error("No company to send from.");

  const to = await recipientId(companyId, input.to);
  await post("/emails", {
    companyId: Number(companyId),
    subject: input.subject,
    // The column is HTML. The composer is plain text, so it is escaped rather
    // than passed through — an address with an angle bracket in it would
    // otherwise become markup.
    bodyHtml: `<p>${escapeHtml(input.message).replace(/\n/g, "<br>")}</p>`,
    to: [to],
  });
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
  const data = await post<{ conversation: BackendConversation }>(
    "/chat/conversations",
    {
      companyId: Number(companyId),
      // The manager names who they are opening with; a customer or specialist
      // omits it and the server resolves the company's manager for them.
      ...(participantUserId ? { participantUserId } : {}),
    },
  );
  return data.conversation;
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

  const data = await post<{ message: BackendMessage }>(
    `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    { files: [{ key: uploads[0].key, fileName: file.name }] },
  );
  return toChatMessage(data.message);
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

/* ---------------------------------------------------------------- mock ---- */

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const COMPANIES: ClientCompanyDetail[] = [
  {
    id: "harbor",
    name: "Harbor Coffee Roasters",
    owner: "Priya Nair",
    activeServices: ["Bookkeeping", "Payroll", "Taxes"],
    billingDate: "8/08/26",
    // The manager counts as a team member on every company it manages — 1.0
    // lists them in this column alongside the customer's own people.
    teamMembers: ["Priya Nair", "Tom Becker", "Alex Morgan"],
    email: "accounts@harborcoffee.com",
    enNumber: "84-2910337",
    addressLine1: "412 Dock Street",
    city: "Portland",
    state: "OR",
    zip: "97204",
    country: "United States of America",
    plans: [
      { service: "Bookkeeping", plan: "Starter", amount: "$99/month" },
      {
        service: "Payroll",
        plan: "2-employee , 3- Contractor",
        amount: "$89/month",
      },
      { service: "Taxes", plan: "$500K - $2M revenue", amount: "$125/month" },
    ],
  },
  {
    id: "vertex",
    name: "Vertex Labs",
    owner: "Daniel Okafor",
    activeServices: ["Bookkeeping", "Payroll"],
    // Blank in 1.0 until a subscription starts.
    billingDate: null,
    teamMembers: ["Daniel Okafor", "Rosa Delgado", "Ivan Petrov", "Alex Morgan"],
    email: "finance@vertexlabs.io",
    enNumber: "",
    addressLine1: "9 Kestrel Way",
    city: "Austin",
    state: "TX",
    zip: "73301",
    country: "United States of America",
    plans: [
      { service: "Bookkeeping", plan: "Growth", amount: "$249/month" },
      { service: "Payroll", plan: "1-employee , 6- Contractor", amount: "$69/month" },
    ],
  },
];

const CUSTOMERS: ManagerCustomer[] = [
  {
    name: "Priya Nair",
    role: "Owner",
    email: "priya.nair@harborcoffee.com",
    companies: ["Harbor Coffee Roasters"],
    companyIds: ["harbor"],
    position: "Company Owner",
    phone: "5550142",
    addressLine1: "412 Dock Street",
    city: "Portland",
    state: "OR",
    zip: "97204",
    country: "United States of America",
  },
  {
    name: "Tom Becker",
    role: "Teammate",
    email: "tom.becker@harborcoffee.com",
    companies: ["Harbor Coffee Roasters"],
    companyIds: ["harbor"],
    position: "Operations",
    phone: "",
    addressLine1: "",
    city: "",
    state: "",
    zip: "",
    country: "United States of America",
  },
  {
    name: "Daniel Okafor",
    role: "Owner",
    email: "daniel.okafor@vertexlabs.io",
    // Multi-company, the case 1.0 renders as a comma list.
    companies: ["Vertex Labs", "Harbor Coffee Roasters"],
    companyIds: ["vertex", "harbor"],
    position: "Company Owner",
    phone: "5550196",
    addressLine1: "9 Kestrel Way",
    city: "Austin",
    state: "TX",
    zip: "73301",
    country: "United States of America",
  },
];

const TASKS: ProjectTask[] = [
  {
    id: "t1",
    projectId: "p1",
    name: "Collect June timesheets",
    description: "Chase the two outstanding contractor submissions.",
    status: "Completed",
    deadline: "7/28/26",
  },
  {
    id: "t2",
    projectId: "p1",
    name: "Run payroll preview",
    description: "Check gross-to-net against last cycle before approval.",
    status: "In progress",
    deadline: "8/01/26",
  },
  {
    id: "t3",
    projectId: "p1",
    name: "File state withholding",
    description: "OR quarterly filing.",
    status: "To do",
    deadline: "8/05/26",
  },
  {
    id: "t4",
    projectId: "p3",
    name: "Reconcile 1099 totals",
    description: "Match contractor payments to the filed return.",
    status: "Completed",
    deadline: "7/10/26",
  },
  {
    id: "t5",
    projectId: "p5",
    name: "Collect contractor W-9s",
    description: "Six new contractors, none returned yet.",
    status: "In progress",
    deadline: "8/22/26",
  },
  {
    id: "t6",
    projectId: "p5",
    name: "Set up direct deposit",
    description: "Bank details verified before the first run.",
    status: "To do",
    deadline: "8/26/26",
  },
];

const PROJECTS: ManagedProject[] = [
  {
    id: "p1",
    name: "July payroll run",
    company: "Harbor Coffee Roasters",
    companyId: "harbor",
    service: "Payroll",
    deadline: "8/05/26",
    status: "In progress",
    specialist: "Rosa Delgado",
    createdBy: "Priya Nair",
    progress: 60,
    createdOn: "6/09/26",
  },
  {
    // Unassigned on purpose: the queue this portal exists to clear.
    id: "p2",
    name: "Q2 bookkeeping close",
    company: "Harbor Coffee Roasters",
    companyId: "harbor",
    service: "Bookkeeping",
    deadline: "8/12/26",
    status: "Not started",
    specialist: null,
    createdBy: "Priya Nair",
    progress: 0,
    createdOn: "7/02/26",
  },
  {
    id: "p3",
    name: "2025 federal return",
    company: "Harbor Coffee Roasters",
    companyId: "harbor",
    service: "Taxes",
    deadline: "7/15/26",
    status: "Completed",
    specialist: "Ivan Petrov",
    createdBy: "Alex Morgan",
    progress: 100,
    createdOn: "5/20/26",
  },
  {
    id: "p4",
    name: "Opening balances",
    company: "Vertex Labs",
    companyId: "vertex",
    service: "Bookkeeping",
    deadline: "8/20/26",
    status: "Not started",
    specialist: null,
    createdBy: "Daniel Okafor",
    progress: 0,
    createdOn: "7/18/26",
  },
  {
    // Second company for Rosa: a specialist's book spans companies, which is
    // what makes the switcher mean anything in their portal.
    id: "p5",
    name: "Contractor onboarding",
    company: "Vertex Labs",
    companyId: "vertex",
    service: "Payroll",
    deadline: "8/28/26",
    status: "In progress",
    specialist: "Rosa Delgado",
    createdBy: "Daniel Okafor",
    progress: 35,
    createdOn: "7/22/26",
  },
];

const SPECIALISTS: SpecialistDetail[] = [
  {
    name: "Rosa Delgado",
    email: "rosa.delgado@finopsys.ai",
    speciality: "Payroll Specialist",
    activeProjects: 2,
    phone: "+1 503 555 0147",
    address: "1120 SE Belmont St, Portland, OR 97214",
  },
  {
    name: "Ivan Petrov",
    email: "ivan.petrov@finopsys.ai",
    speciality: "Tax Specialist",
    activeProjects: 0,
    phone: "+1 512 555 0182",
    address: "88 Congress Ave, Austin, TX 78701",
  },
  {
    name: "Nadia Haddad",
    // Misspelling preserved: existing records store this exact string, so
    // correcting it here would stop matching them. See lib/admin.ts.
    speciality: "Bookkeping Specialist",
    email: "nadia.haddad@finopsys.ai",
    activeProjects: 2,
    phone: "+1 646 555 0113",
    address: "410 W 24th St, New York, NY 10011",
  },
];

const CONVERSATIONS: Conversation[] = [
  // Chat · customers
  {
    id: "c1",
    companyId: "harbor",
    company: "Harbor Coffee Roasters",
    contact: "Priya Nair",
    channel: "chat",
    party: "customer",
    lastMessage: "Can you confirm the July payroll totals before Friday?",
    lastMessageAt: "8/14/26",
    unread: 2,
  },
  {
    id: "c2",
    companyId: "vertex",
    company: "Vertex Labs",
    contact: "Daniel Okafor",
    channel: "chat",
    party: "customer",
    lastMessage: "Are we still on track for the opening balances?",
    lastMessageAt: "8/09/26",
    unread: 0,
  },
  // Chat · specialists
  {
    id: "c3",
    companyId: "harbor",
    company: "Harbor Coffee Roasters",
    contact: "Rosa Delgado",
    channel: "chat",
    party: "specialist",
    lastMessage: "Payroll register is ready for your review.",
    lastMessageAt: "8/15/26",
    unread: 1,
  },
  {
    id: "c4",
    companyId: "vertex",
    company: "Vertex Labs",
    contact: "Nadia Haddad",
    channel: "chat",
    party: "specialist",
    lastMessage: "Need the articles of incorporation before I can start.",
    lastMessageAt: "8/11/26",
    unread: 0,
  },
  // Email · customers
  {
    id: "c5",
    companyId: "vertex",
    company: "Vertex Labs",
    contact: "Daniel Okafor",
    channel: "email",
    party: "customer",
    lastMessage: "Sent over the opening balance spreadsheet.",
    lastMessageAt: "8/12/26",
    unread: 1,
  },
  {
    id: "c6",
    companyId: "harbor",
    company: "Harbor Coffee Roasters",
    contact: "Tom Becker",
    channel: "email",
    party: "customer",
    lastMessage: "Thanks, that clears it up.",
    lastMessageAt: "8/03/26",
    unread: 0,
  },
  // Email · specialists
  {
    id: "c7",
    companyId: "harbor",
    company: "Harbor Coffee Roasters",
    contact: "Ivan Petrov",
    channel: "email",
    party: "specialist",
    lastMessage: "Federal return filed, confirmation attached.",
    lastMessageAt: "7/16/26",
    unread: 0,
  },
];

/** N days back at a given clock time, so the mock threads keep their shape. */
function daysAgo(days: number, hour: number, minute: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

/** Threads, keyed by conversation id. Ends on the conversation's lastMessage. */
const MESSAGES: Record<string, ChatMessage[]> = {
  c1: [
    {
      id: "c1-1",
      mine: false,
      body: "Morning — quick one on payroll.",
      sentAt: daysAgo(1, 9, 12),
      attachments: [],
    },
    { id: "c1-2", mine: true, body: "Go ahead.", sentAt: daysAgo(1, 9, 15), attachments: [] },
    {
      id: "c1-3",
      mine: false,
      body: "Can you confirm the July payroll totals before Friday?",
      sentAt: daysAgo(0, 8, 41),
      attachments: [],
    },
  ],
  c2: [
    {
      id: "c2-1",
      mine: false,
      body: "Are we still on track for the opening balances?",
      sentAt: daysAgo(4, 16, 3),
      attachments: [],
    },
  ],
  c3: [
    {
      id: "c3-1",
      mine: true,
      body: "How is the July run looking?",
      sentAt: daysAgo(1, 14, 20),
      attachments: [],
    },
    {
      id: "c3-2",
      mine: false,
      body: "Payroll register is ready for your review.",
      sentAt: daysAgo(0, 10, 5),
      attachments: [],
    },
  ],
  c4: [
    {
      id: "c4-1",
      mine: false,
      body: "Need the articles of incorporation before I can start.",
      sentAt: daysAgo(8, 11, 47),
      attachments: [],
    },
  ],
};

const DOCUMENTS: ManagerDocument[] = [
  {
    id: "d1",
    name: "june-bank-statement.pdf",
    companyId: "harbor",
    company: "Harbor Coffee Roasters",
    project: "Q2 bookkeeping close",
    owner: "Priya Nair",
    uploadedAt: "7/02/26",
    size: 204_800,
  },
  {
    id: "d2",
    name: "payroll-register-july.xlsx",
    companyId: "harbor",
    company: "Harbor Coffee Roasters",
    project: "July payroll run",
    owner: "Rosa Delgado",
    uploadedAt: "7/28/26",
    size: 1_887_437,
  },
  {
    id: "d3",
    name: "w9-forms.zip",
    companyId: "harbor",
    company: "Harbor Coffee Roasters",
    project: "July payroll run",
    owner: "Tom Becker",
    uploadedAt: "7/30/26",
    size: 12_582_912,
  },
  {
    // No project: files arrive before there is anything to attach them to.
    id: "d4",
    name: "articles-of-incorporation.pdf",
    companyId: "vertex",
    company: "Vertex Labs",
    project: null,
    owner: "Daniel Okafor",
    uploadedAt: "8/11/26",
    size: 737_280,
  },
  {
    id: "d5",
    name: "contractor-roster.xlsx",
    companyId: "vertex",
    company: "Vertex Labs",
    project: "Contractor onboarding",
    owner: "Rosa Delgado",
    uploadedAt: "8/13/26",
    size: 96_256,
  },
];

const mock = {
  async ok(): Promise<void> {
    await delay();
  },

  async conversations(filter: ConversationFilter): Promise<Conversation[]> {
    await delay();
    const rows = CONVERSATIONS.filter(
      (c) =>
        (!filter.companyId || c.companyId === filter.companyId) &&
        (!filter.channel || c.channel === filter.channel) &&
        (!filter.party || c.party === filter.party),
    );
    return sortByUnreadThenRecent(rows);
  },

  async messages(conversationId: string): Promise<ChatMessage[]> {
    await delay(150);
    // A copy, not the fixture itself. The view holds what it is handed in
    // state and appends each send to it — hand back the live array and the
    // send lands in it twice, once from here and once from the append.
    return [...(MESSAGES[conversationId] ?? [])];
  },

  async sendMessage(
    conversationId: string,
    body: string,
  ): Promise<ChatMessage> {
    await delay(150);
    const thread = (MESSAGES[conversationId] ??= []);
    const message: ChatMessage = {
      id: `${conversationId}-${thread.length + 1}`,
      mine: true,
      body,
      sentAt: new Date().toISOString(),
      attachments: [],
    };
    thread.push(message);
    return message;
  },

  async sendAttachment(
    conversationId: string,
    file: File,
  ): Promise<ChatMessage> {
    await delay(150);
    const thread = (MESSAGES[conversationId] ??= []);
    const message: ChatMessage = {
      id: `${conversationId}-${thread.length + 1}`,
      mine: true,
      body: "",
      sentAt: new Date().toISOString(),
      // Mock ids are negative so a real attachment id can never collide.
      attachments: [{ id: -Date.now(), name: file.name, size: file.size }],
    };
    thread.push(message);
    return message;
  },

  async uploadDocument(
    file: File,
    meta: { companyId: string; project: string | null; owner: string },
  ): Promise<ManagerDocument> {
    await delay();
    const company = COMPANIES.find((c) => c.id === meta.companyId);
    if (!company) throw new Error("That company no longer exists.");

    const doc: ManagerDocument = {
      id: `d${DOCUMENTS.length + 1}`,
      name: file.name,
      companyId: company.id,
      company: company.name,
      project: meta.project,
      owner: meta.owner,
      uploadedAt: toStamp(new Date().toISOString().slice(0, 10)),
      size: file.size,
    };
    DOCUMENTS.push(doc);
    return doc;
  },

  async documents(
    companyId?: string,
    project?: string,
  ): Promise<ManagerDocument[]> {
    await delay();
    const rows = DOCUMENTS.filter(
      (d) =>
        (!companyId || d.companyId === companyId) &&
        (!project || d.project === project),
    );
    return [...rows].sort(
      (a, b) =>
        parseDeadline(b.uploadedAt).getTime() -
        parseDeadline(a.uploadedAt).getTime(),
    );
  },

  async profile(): Promise<ManagerProfile> {
    await delay(150);
    return {
      name: "Alex Morgan",
      email: "alex.morgan@finopsys.ai",
      phone: "5550188",
    };
  },

  async companies(): Promise<ClientCompany[]> {
    await delay();
    return COMPANIES;
  },

  async company(id: string): Promise<ClientCompanyDetail | null> {
    await delay();
    return COMPANIES.find((c) => c.id === id) ?? null;
  },

  async customers(companyId?: string): Promise<ManagerCustomer[]> {
    await delay();
    if (!companyId) return CUSTOMERS;
    return CUSTOMERS.filter((c) => c.companyIds.includes(companyId));
  },

  async customer(email: string): Promise<ManagerCustomer | null> {
    await delay();
    return CUSTOMERS.find((c) => c.email === email) ?? null;
  },

  async tasks(projectId: string): Promise<ProjectTask[]> {
    await delay();
    return TASKS.filter((t) => t.projectId === projectId);
  },

  /**
   * Adds the row rather than resolving empty. The modal refreshes the page on
   * success, and a create that leaves the list unchanged reads as a failure.
   * The deadline arrives from a date input as `2026-09-01` and is stored in
   * 1.0's format so it sorts and renders with every other row.
   */
  async addTask(
    projectId: string,
    task: { name: string; description: string; deadline: string },
  ): Promise<void> {
    await delay();
    TASKS.push({
      id: `t${TASKS.length + 1}`,
      projectId,
      name: task.name,
      description: task.description,
      status: "To do",
      deadline: toStamp(task.deadline),
    });
  },

  async projects(companyId?: string): Promise<ManagedProject[]> {
    await delay();
    if (!companyId) return PROJECTS;
    return PROJECTS.filter((p) => p.companyId === companyId);
  },

  async project(id: string): Promise<ManagedProject | null> {
    await delay();
    return PROJECTS.find((p) => p.id === id) ?? null;
  },

  async specialists(companyId?: string): Promise<Specialist[]> {
    await delay();
    if (!companyId) return SPECIALISTS;
    const onCompany = new Set(
      PROJECTS.filter((p) => p.companyId === companyId)
        .map((p) => p.specialist)
        .filter(Boolean),
    );
    return SPECIALISTS.filter((s) => onCompany.has(s.name));
  },

  async specialist(email: string): Promise<SpecialistDetail | null> {
    await delay();
    return SPECIALISTS.find((s) => s.email === email) ?? null;
  },

  async specialistTasks(email: string): Promise<SpecialistTask[]> {
    await delay();
    const specialist = SPECIALISTS.find((s) => s.email === email);
    if (!specialist) return [];

    // Assignment is project-level in 1.0 — a task has no assignee of its own,
    // so a specialist's work is every task on the projects routed to them.
    return PROJECTS.filter((p) => p.specialist === specialist.name).flatMap(
      (project) =>
        TASKS.filter((t) => t.projectId === project.id).map((task) => ({
          ...task,
          project: project.name,
        })),
    );
  },

  async setTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    await delay(150);
    const task = TASKS.find((t) => t.id === taskId);
    if (!task) throw new Error("That task no longer exists.");
    task.status = status;
  },
};

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
 * `9/01/26`. Month unpadded, day padded — that is what the fixtures carry, and
 * a row written in one format inside a column of another reads as a bug.
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
