/**
 * Customer portal API boundary.
 *
 * Same contract as lib/api.ts and lib/admin.ts: real shapes and real fetch
 * calls when NEXT_PUBLIC_API_URL is set, an in-file mock otherwise.
 *
 * Fixtures are invented (example.com per RFC 2606) but keep the awkward shapes
 * the live app has — a customer in two companies, a company with no billing
 * date, an empty file list — because those are the cases the UI has to
 * survive.
 */

import {
  BASE,
  get,
  getOrNull,
  patch,
  post,
  uploadViaSignedUrls,
} from "@/lib/http";
import {
  managerApi,
  openConversation,
  sendChatAttachment,
  sendEmailAs,
  toStamp,
  type ChatMessage,
  type ManagerProfile,
  type ManagerThread,
} from "@/lib/manager";
import { countryCode } from "@/lib/countries";
import { fullName, roleIds } from "@/lib/directory";
import {
  billingDate,
  personName,
  teamNames,
  toAddressFields,
  toProjectStatus,
  type BackendCompany,
  type BackendDocument,
  type BackendProject,
} from "@/lib/portal";

export interface Workspace {
  id: string;
  name: string;
}

export type ProjectStatus = "Not started" | "In progress" | "Completed";

export interface Project {
  id: string;
  name: string;
  service: string;
  deadline: string;
  status: ProjectStatus;
  specialist: string | null;
}

export interface CustomerFile {
  id: string;
  name: string;
  project: string;
  owner: string;
  uploadedAt: string;
  /** Bytes. Rendered beneath the file name, as in the staff portals. */
  size: number;
}

export interface CustomerCompany {
  id: string;
  name: string;
  activeServices: string[];
  subscriptionDate: string | null;
  teamMembers: string[];
}

export interface TeamMember {
  name: string;
  jobTitle: string;
  email: string;
}

export interface Profile {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface NewProjectInput {
  name: string;
  service: string;
  deadline: string;
}

export interface InviteTeammateInput {
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
}

/**
 * A WORKSPACE IS A COMPANY.
 *
 * The customer portal calls it a workspace and routes on it
 * (`/customer/[workspace]/...`); the backend calls it a company and takes it as
 * `?companyId=`. Same id, two words — so `workspaceId` goes straight into the
 * query with no lookup, and nothing invents a `?workspace=` parameter the
 * server has never accepted.
 */
export const customerApi = {
  /** The picker after sign-in: companies this person owns. */
  async workspaces(): Promise<Workspace[]> {
    if (!BASE) return mock.workspaces();
    const data = await get<{
      companies: { companyId: number; companyName: string }[];
    }>("/companies/owned");
    return data.companies.map((c) => ({
      id: String(c.companyId),
      name: c.companyName,
    }));
  },

  async projects(workspaceId: string): Promise<Project[]> {
    if (!BASE) return mock.projects(workspaceId);
    // ponytail: 100 is the server's own maxLimit, and the whole set is fetched
    // in one request so the table can page it locally. Past 100 rows the
    // remainder is silently absent — move to `?limit=&offset=` per page (as the
    // admin lists do) when a workspace realistically holds that many.
    const data = await get<{ projects: BackendProject[] }>(
      `/projects?companyId=${encodeURIComponent(workspaceId)}&limit=100`,
    );
    return data.projects.map(toProject);
  },

  /**
   * Services a project can be opened against.
   *
   * In 1.0 this list is broken: it offers only Payroll even when the company
   * has Bookkeeping and Taxes active. The backend derives it from what the
   * company actually pays for — and drops any service whose base plan is
   * missing, because offering an option the write would refuse is exactly what
   * building it server-side prevents.
   */
  async availableServices(workspaceId: string): Promise<string[]> {
    if (!BASE) return mock.availableServices(workspaceId);
    const services = await serviceOptions(workspaceId);
    return services.map((s) => s.serviceName);
  },

  /**
   * The form picks a service by NAME; the endpoint wants the id of that
   * service's base plan, so the option list is read back to resolve it.
   */
  async createProject(
    workspaceId: string,
    input: NewProjectInput,
  ): Promise<Project> {
    if (!BASE) return mock.createProject(input);

    const services = await serviceOptions(workspaceId);
    const service = services.find((s) => s.serviceName === input.service);
    if (!service) {
      throw new Error(`${input.service} is not active on this company.`);
    }

    // The created project IS the payload — `data` is the row, not `{ project }`.
    // The controller's own Location header (`${req.baseUrl}/${data.id}`) is the
    // proof. Reading `.project` here yielded `undefined`, and `toProject` threw
    // on it, so every create failed after the record had already been written.
    const project = await post<BackendProject>("/projects", {
      companyId: Number(workspaceId),
      projectName: input.name,
      deadlineDate: input.deadline,
      servicePlanId: service.servicePlanId,
    });
    return toProject(project);
  },

  async project(workspaceId: string, id: string): Promise<Project | null> {
    if (!BASE) return mock.project(workspaceId, id);
    // `getOrNull`, not `.catch(() => null)`: that swallowed every failure, so a
    // 403 or a dead backend rendered as "project not found" — a wrong answer
    // that looks like a real one. Only a 404 is absence.
    const row = await getOrNull<BackendProject>(
      `/projects/${encodeURIComponent(id)}`,
    );
    // Guarded rather than trusted: the id comes off a URL, and this is what
    // stops one workspace's link resolving another's project.
    if (!row || String(row.companyId) !== workspaceId) return null;
    return toProject(row);
  },

  async files(
    workspaceId: string,
    projectName?: string,
  ): Promise<CustomerFile[]> {
    if (!BASE) return mock.files(workspaceId, projectName);
    // ponytail: 100 is the server's own maxLimit, and the whole set is fetched
    // in one request so the table can page it locally. Past 100 rows the
    // remainder is silently absent — move to `?limit=&offset=` per page (as the
    // admin lists do) when a workspace realistically holds that many.
    const data = await get<{ documents: BackendDocument[] }>(
      `/documents?companyId=${encodeURIComponent(workspaceId)}&limit=100`,
    );

    const files = data.documents.map((d) => ({
      id: String(d.id),
      name: d.fileName,
      project: d.project?.projectName ?? "",
      owner: personName(d.uploadedBy),
      uploadedAt: d.createdAt,
      size: d.sizeBytes,
    }));

    return projectName ? files.filter((f) => f.project === projectName) : files;
  },

  /**
   * Attach a file to one of the workspace's projects.
   *
   * Three calls, not one: a ticket for a signed URL, the PUT straight to
   * storage, then the confirm that makes the document exist. The owner is the
   * session throughout — a client that can name the uploader can name anyone.
   */
  async uploadFile(
    workspaceId: string,
    file: File,
    meta: { project: string },
  ): Promise<CustomerFile> {
    if (!BASE) return mock.uploadFile(workspaceId, file, meta);

    // ponytail: resolves a project NAME to its id by scanning the first 100.
    // An upload against project 101 fails with "No project named X" — send the
    // id from the picker instead of the name when that becomes reachable.
    const data = await get<{ projects: BackendProject[] }>(
      `/projects?companyId=${encodeURIComponent(workspaceId)}&limit=100`,
    );
    const target = data.projects.find((p) => p.projectName === meta.project);
    if (!target) throw new Error(`No project named ${meta.project}.`);

    const result = await uploadViaSignedUrls<{ documents: BackendDocument[] }>(
      `/projects/${target.id}/documents/upload-url`,
      `/projects/${target.id}/documents/confirm`,
      workspaceId,
      [file],
    );

    const doc = result.documents[0];
    return {
      id: String(doc.id),
      name: doc.fileName,
      project: meta.project,
      owner: personName(doc.uploadedBy),
      uploadedAt: doc.createdAt,
      size: doc.sizeBytes,
    };
  },

  async companies(): Promise<CustomerCompany[]> {
    if (!BASE) return mock.companies();
    // ponytail: 100 is the server's own maxLimit, and the whole set is fetched
    // in one request so the table can page it locally. Past 100 rows the
    // remainder is silently absent — move to `?limit=&offset=` per page (as the
    // admin lists do) when a workspace realistically holds that many.
    const data = await get<{ companies: BackendCompany[] }>(
      "/companies?limit=100",
    );
    return data.companies.map((c) => ({
      id: String(c.id),
      name: c.companyName,
      activeServices: (c.activeServices ?? []).map((s) => s.specializationName),
      subscriptionDate: billingDate(c),
      teamMembers: teamNames(c),
    }));
  },

  async team(workspaceId: string): Promise<TeamMember[]> {
    if (!BASE) return mock.team(workspaceId);
    const data = await get<{
      teammates: {
        firstName: string;
        lastName: string;
        jobTitle: string | null;
        email: string;
      }[];
    }>(`/teammates?companyId=${encodeURIComponent(workspaceId)}`);

    return data.teammates.map((t) => ({
      name: fullName(t),
      jobTitle: t.jobTitle ?? "",
      email: t.email,
    }));
  },

  /**
   * `POST /invitations/teammates`, which is OWNER-only and takes the companies
   * the teammate joins as a list — one invitation can span several.
   */
  async inviteTeammate(
    workspaceId: string,
    input: InviteTeammateInput,
  ): Promise<void> {
    if (!BASE) return mock.ok();
    const ids = await roleIds("CUSTOMER", "TEAM");
    await post("/invitations/teammates", {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      jobTitle: input.jobTitle,
      companyIds: [Number(workspaceId)],
      ...ids,
    });
  },

  async profile(): Promise<Profile> {
    if (!BASE) return mock.profile();
    const me = await get<{
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      address: Parameters<typeof toAddressFields>[0];
    }>("/users/me");

    return {
      fullName: fullName(me),
      email: me.email,
      phone: me.phone ?? "",
      ...toAddressFields(me.address),
    };
  },

  /**
   * `PATCH /users/me`, and it accepts only `phone` and `address` — name and
   * email are not the caller's to change here. The address goes whole, never
   * field by field: a half-updated address is worse than requiring all of it.
   */
  async saveProfile(input: Profile): Promise<void> {
    if (!BASE) return mock.ok();
    await patch("/users/me", {
      phone: input.phone,
      address: {
        addressLine1: input.addressLine1,
        city: input.city,
        state: input.state,
        postalCode: input.zip,
        country: input.country,
        countryCode: countryCode(input.country),
      },
    });
  },

  /* ------------------------------------------------------------ connect -- */

  /**
   * The accounting manager on this company — the customer's single point of
   * contact. Per workspace, because a customer in two companies can be routed
   * to two different managers.
   */
  async manager(workspaceId: string): Promise<ManagerProfile> {
    if (!BASE) return mock.manager();
    // `data: { company }`, not the row. Read a level too high and the contact
    // card renders with an empty name and no email — the one screen whose whole
    // job is telling a customer who to talk to.
    const { company } = await get<{ company: BackendCompany }>(
      `/companies/${encodeURIComponent(workspaceId)}`,
    );
    const am = company.accountingManager;
    return { name: personName(am), email: am?.email ?? "", phone: "" };
  },

  async thread(workspaceId: string): Promise<ManagerThread> {
    if (!BASE) return mock.thread();
    const conversation = await openConversation(workspaceId);
    return {
      id: String(conversation.id),
      contact: personName(conversation.counterpart),
      unread: conversation.unreadCount ?? 0,
    };
  },

  async messages(workspaceId: string): Promise<ChatMessage[]> {
    if (!BASE) return mock.messages(workspaceId);
    const conversation = await openConversation(workspaceId);
    return managerApi.messages(String(conversation.id));
  },

  async sendMessage(workspaceId: string, body: string): Promise<ChatMessage> {
    if (!BASE) return mock.sendMessage(workspaceId, body);
    const conversation = await openConversation(workspaceId);
    return managerApi.sendMessage(String(conversation.id), body);
  },

  async sendAttachment(workspaceId: string, file: File): Promise<ChatMessage> {
    if (!BASE) return mock.sendAttachment(workspaceId, file);
    const conversation = await openConversation(workspaceId);
    return sendChatAttachment(String(conversation.id), file);
  },

  async sendEmail(input: {
    to: string;
    subject: string;
    message: string;
    companyId?: string;
  }): Promise<void> {
    if (!BASE) return mock.ok();
    await sendEmailAs(input);
  },
};

/* ------------------------------------------------------- live helpers ---- */

interface ServiceOption {
  servicePlanId: number;
  serviceName: string;
  serviceCode: string;
}

/** What the company pays for, as the project form's dropdown. */
async function serviceOptions(workspaceId: string): Promise<ServiceOption[]> {
  const data = await get<{ services: ServiceOption[] }>(
    `/projects/services?companyId=${encodeURIComponent(workspaceId)}`,
  );
  return data.services;
}

function toProject(p: BackendProject): Project {
  return {
    id: String(p.id),
    name: p.projectName,
    service: p.service?.serviceName ?? "",
    deadline: p.deadlineDate ?? "",
    status: toProjectStatus(p.status),
    specialist: p.specialist ? personName(p.specialist) : null,
  };
}

/* ---------------------------------------------------------------- mock ---- */

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const WORKSPACES: Workspace[] = [
  { id: "harbor", name: "Harbor Coffee Roasters" },
  { id: "lakeside", name: "Lakeside Dental" },
];

const SERVICES: Record<string, string[]> = {
  harbor: ["Bookkeeping", "Payroll", "Taxes"],
  lakeside: ["Payroll"],
};

const PROJECTS: Record<string, Project[]> = {
  harbor: [
    {
      id: "p1",
      name: "July payroll run",
      service: "Payroll",
      deadline: "8/05/26",
      status: "In progress",
      specialist: "Rosa Delgado",
    },
    {
      id: "p2",
      name: "Q2 bookkeeping close",
      service: "Bookkeeping",
      deadline: "8/12/26",
      status: "Not started",
      specialist: null,
    },
    {
      id: "p3",
      name: "2025 federal return",
      service: "Taxes",
      deadline: "7/15/26",
      status: "Completed",
      specialist: "Ivan Petrov",
    },
  ],
  // Empty on purpose: the empty state is a real screen in 1.0.
  lakeside: [],
};

const FILES: Record<string, CustomerFile[]> = {
  harbor: [
    {
      id: "f1",
      name: "june-bank-statement.pdf",
      project: "Q2 bookkeeping close",
      owner: "Priya Nair",
      uploadedAt: "7/02/26",
      size: 284_160,
    },
    {
      id: "f2",
      name: "payroll-register-july.xlsx",
      project: "July payroll run",
      owner: "Rosa Delgado",
      uploadedAt: "7/28/26",
      size: 61_440,
    },
    {
      id: "f3",
      name: "w9-forms.zip",
      project: "July payroll run",
      owner: "Tom Becker",
      uploadedAt: "7/30/26",
      size: 4_508_876,
    },
  ],
  lakeside: [],
};

const TEAM: Record<string, TeamMember[]> = {
  harbor: [
    {
      name: "Priya Nair",
      jobTitle: "Company Owner",
      email: "priya.nair@example.com",
    },
    {
      name: "Tom Becker",
      jobTitle: "Office Manager",
      email: "tom.becker@example.com",
    },
  ],
  lakeside: [
    {
      name: "Priya Nair",
      jobTitle: "Company Owner",
      email: "priya.nair@example.com",
    },
  ],
};

/**
 * The customer's half of the thread with their accounting manager, one per
 * workspace. `mine` is the customer — 1.0 stores a thread per pair and each
 * side has its own idea of who "me" is, so this is not the manager's fixture
 * with `mine` inverted.
 *
 * Lakeside starts empty on purpose: a first message into a blank thread is a
 * screen the chat has to survive.
 */
const THREADS: Record<string, ChatMessage[]> = {
  harbor: [
    {
      id: "cm-1",
      mine: true,
      body: "Can you confirm the cutoff for the July payroll run?",
      sentAt: daysAgo(1, 9, 12),
      attachments: [],
    },
    {
      id: "cm-2",
      mine: false,
      body: "The 3rd. Rosa has the register ready for your review.",
      sentAt: daysAgo(0, 11, 40),
      attachments: [],
    },
  ],
  lakeside: [],
};

/** N days back at a given clock time, so the mock thread keeps its shape. */
function daysAgo(days: number, hour: number, minute: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

const mock = {
  async ok(): Promise<void> {
    await delay();
  },

  async workspaces(): Promise<Workspace[]> {
    await delay(150);
    return WORKSPACES;
  },

  async projects(workspaceId: string): Promise<Project[]> {
    await delay();
    return PROJECTS[workspaceId] ?? [];
  },

  async availableServices(workspaceId: string): Promise<string[]> {
    await delay(150);
    return SERVICES[workspaceId] ?? [];
  },

  async createProject(input: NewProjectInput): Promise<Project> {
    await delay();
    return {
      id: `p${Math.abs(hash(input.name))}`,
      name: input.name,
      service: input.service,
      deadline: input.deadline,
      status: "Not started",
      specialist: null,
    };
  },

  async project(workspaceId: string, id: string): Promise<Project | null> {
    await delay();
    // Scoped by workspace, not looked up globally: an id from another company
    // must not resolve here.
    return (PROJECTS[workspaceId] ?? []).find((p) => p.id === id) ?? null;
  },

  async files(
    workspaceId: string,
    projectName?: string,
  ): Promise<CustomerFile[]> {
    await delay();
    const rows = FILES[workspaceId] ?? [];
    return projectName
      ? rows.filter((f) => f.project === projectName)
      : rows;
  },

  async uploadFile(
    workspaceId: string,
    file: File,
    meta: { project: string },
  ): Promise<CustomerFile> {
    await delay();
    const projects = PROJECTS[workspaceId] ?? [];
    // Checked rather than trusted: the project name arrives from a form and
    // the workspace from a URL param. The server has to repeat it — a mock is
    // not a boundary.
    if (!projects.some((p) => p.name === meta.project)) {
      throw new Error("That project is not in this workspace.");
    }

    const me = await mock.profile();
    const row: CustomerFile = {
      id: `f${Date.now()}`,
      name: file.name,
      project: meta.project,
      owner: me.fullName,
      uploadedAt: toStamp(new Date().toISOString().slice(0, 10)),
      size: file.size,
    };
    FILES[workspaceId] = [row, ...(FILES[workspaceId] ?? [])];
    return row;
  },

  async companies(): Promise<CustomerCompany[]> {
    await delay();
    return [
      {
        id: "harbor",
        name: "Harbor Coffee Roasters",
        activeServices: ["Bookkeeping", "Payroll", "Taxes"],
        subscriptionDate: "6/08/26",
        teamMembers: ["Priya Nair", "Tom Becker"],
      },
      {
        id: "lakeside",
        name: "Lakeside Dental",
        activeServices: ["Payroll"],
        subscriptionDate: null,
        teamMembers: ["Priya Nair"],
      },
    ];
  },

  async team(workspaceId: string): Promise<TeamMember[]> {
    await delay();
    return TEAM[workspaceId] ?? [];
  },

  async profile(): Promise<Profile> {
    await delay();
    return {
      fullName: "Priya Nair",
      email: "priya.nair@example.com",
      phone: "5550142",
      addressLine1: "",
      city: "",
      state: "",
      zip: "",
      country: "United States of America",
    };
  },

  manager: managerApi.profile,

  async thread(): Promise<ManagerThread> {
    const manager = await managerApi.profile();
    // 0 unread: nothing here tracks what the customer has read, and a badge
    // off a message count would be wrong the moment the thread is opened.
    return { id: null, contact: manager.name, unread: 0 };
  },

  async messages(workspaceId: string): Promise<ChatMessage[]> {
    await delay(150);
    // A copy, not the fixture itself. The view holds what it is handed in
    // state and appends each send to it — hand back the live array and the
    // send lands in it twice, once from here and once from the append.
    return [...(THREADS[workspaceId] ?? [])];
  },

  async sendMessage(workspaceId: string, body: string): Promise<ChatMessage> {
    return append(workspaceId, { body, attachments: [] });
  },

  async sendAttachment(workspaceId: string, file: File): Promise<ChatMessage> {
    return append(workspaceId, {
      body: "",
      // Mock ids are negative so a real attachment id can never collide.
      attachments: [{ id: -Date.now(), name: file.name, size: file.size }],
    });
  },
};

/** Push a message the customer sent onto their workspace's thread. */
async function append(
  workspaceId: string,
  fields: Omit<ChatMessage, "id" | "mine" | "sentAt">,
): Promise<ChatMessage> {
  await delay(150);
  // A thread the fixtures never seeded is a workspace that does not exist —
  // writing one into being would let an unknown id grow a real conversation.
  const thread = THREADS[workspaceId];
  if (!thread) throw new Error("That workspace is not yours.");

  const message: ChatMessage = {
    id: `cm-${thread.length + 1}`,
    mine: true,
    sentAt: new Date().toISOString(),
    ...fields,
  };
  thread.push(message);
  return message;
}

/** Stable id from a string. Mock only — the backend owns real ids. */
function hash(value: string): number {
  let out = 0;
  for (const char of value) out = (out * 31 + char.charCodeAt(0)) | 0;
  return out;
}
