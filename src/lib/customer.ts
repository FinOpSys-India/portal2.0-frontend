/**
 * Customer portal API boundary.
 *
 * Same contract as lib/api.ts and lib/admin.ts: real shapes and real fetch
 * calls against the backend.
 */

import {
  get,
  getOrNull,
  patch,
  post,
  uploadViaSignedUrls,
} from "@/lib/http";
import {
  createProjectOn,
  managerApi,
  openConversation,
  sendChatAttachment,
  sendEmailAs,
  serviceOptions,
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
  /** `userDto.toMe` builds this from the stored key. Null when none is set. */
  avatarUrl: string | null;
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
    const data = await get<{
      companies: { companyId: number; companyName: string }[];
    }>("/companies/owned");
    return data.companies.map((c) => ({
      id: String(c.companyId),
      name: c.companyName,
    }));
  },

  async projects(workspaceId: string): Promise<Project[]> {
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
    const services = await serviceOptions(workspaceId);
    return services.map((s) => s.serviceName);
  },

  /**
   * The form picks a service by NAME; `createProjectOn` resolves it to the id
   * of that service's base plan, which is what the endpoint takes. Shared with
   * the manager portal, which opens projects against the same endpoint.
   */
  async createProject(
    workspaceId: string,
    input: NewProjectInput,
  ): Promise<Project> {
    return toProject(await createProjectOn(workspaceId, input));
  },

  async project(workspaceId: string, id: string): Promise<Project | null> {
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
    const me = await get<{
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      avatarUrl: string | null;
      address: Parameters<typeof toAddressFields>[0];
    }>("/users/me");

    return {
      fullName: fullName(me),
      email: me.email,
      phone: me.phone ?? "",
      avatarUrl: me.avatarUrl ?? null,
      ...toAddressFields(me.address),
    };
  },

  /**
   * `PATCH /users/me`, and it accepts only `phone` and `address` — name and
   * email are not the caller's to change here. The address goes whole, never
   * field by field: a half-updated address is worse than requiring all of it.
   */
  async saveProfile(input: Profile): Promise<void> {
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
    // `data: { company }`, not the row. Read a level too high and the contact
    // card renders with an empty name and no email — the one screen whose whole
    // job is telling a customer who to talk to.
    const { company } = await get<{ company: BackendCompany }>(
      `/companies/${encodeURIComponent(workspaceId)}`,
    );
    const am = company.accountingManager;
    // No phone and no picture on the joined person: `companyDto` sends a name
    // and an address, and a manager's number is theirs to share.
    return {
      name: personName(am),
      email: am?.email ?? "",
      phone: "",
      avatarUrl: null,
    };
  },

  async thread(workspaceId: string): Promise<ManagerThread> {
    const conversation = await openConversation(workspaceId);
    return {
      id: String(conversation.id),
      contact: personName(conversation.counterpart),
      unread: conversation.unreadCount ?? 0,
    };
  },

  async messages(workspaceId: string): Promise<ChatMessage[]> {
    const conversation = await openConversation(workspaceId);
    return managerApi.messages(String(conversation.id));
  },

  async sendMessage(workspaceId: string, body: string): Promise<ChatMessage> {
    const conversation = await openConversation(workspaceId);
    return managerApi.sendMessage(String(conversation.id), body);
  },

  async sendAttachment(workspaceId: string, file: File): Promise<ChatMessage> {
    const conversation = await openConversation(workspaceId);
    return sendChatAttachment(String(conversation.id), file);
  },

  async sendEmail(input: {
    to: string;
    subject: string;
    message: string;
    companyId?: string;
    files?: File[];
  }): Promise<void> {
    await sendEmailAs(input);
  },
};

/* ------------------------------------------------------- live helpers ---- */

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
