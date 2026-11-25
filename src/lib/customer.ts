/**
 * Customer portal API boundary.
 *
 * Same contract as lib/api.ts and lib/admin.ts: real shapes and real fetch
 * calls against the backend.
 */

import { cache } from "react";

import {
  get,
  getOrNull,
  post,
  uploadViaSignedUrls,
} from "@/lib/http";
import {
  createProjectOn,
  managerApi,
  openConversation,
  openThread,
  sendChatAttachment,
  serviceOptions,
  type ChatMessage,
  type ClientCompanyDetail,
  type ManagerProfile,
  type ManagerThread,
  type ProjectTask,
} from "@/lib/manager";
import { fullName, roleIds } from "@/lib/directory";
import {
  billingDate,
  documentProjectId,
  myProfile,
  personAvatarUrl,
  personId,
  personName,
  specialistTitle,
  teamPeople,
  teammatePeople,
  toClientCompanyDetail,
  toProjectStatus,
  toProjectTask,
  usDate,
  type BackendCompany,
  type BackendPerson,
  type PortalPerson,
  type BackendDocument,
  type BackendProject,
  type BackendTask,
  type BackendTeammate,
  type PreviousProject,
  toPreviousProject,
  serviceGroups,
  type ServiceTab,
} from "@/lib/portal";

export interface Workspace {
  id: string;
  name: string;
  /** Switched off by the owner: left out of the switcher, still openable. */
  inactive?: boolean;
  /** The services it pays for, by name: the sidebar's service groups. */
  services?: string[];
}

export type ProjectStatus = "Not started" | "In progress" | "In review" | "Completed";

export interface Project {
  id: string;
  name: string;
  service: string;
  deadline: string;
  status: ProjectStatus;
  specialist: string | null;
  /** Their picture, when they have one. */
  specialistAvatarUrl: string | null;
  /** See ManagedProject.creatorId. */
  creatorId: string | null;
  /** See ManagedProject.inactive. */
  inactive: boolean;
  /** See ManagedProject.previousProject. */
  previousProject: PreviousProject | null;
  /** ISO instant. What the sidebar counts "new since your last visit" from. */
  createdAt: string;
}

export interface CustomerFile {
  id: string;
  /** Half of the download URL — see ManagerDocument.projectId. */
  projectId: string | null;
  /** The uploader's picture, when they have set one. */
  ownerAvatarUrl?: string | null;
  name: string;
  project: string;
  owner: string;
  /** See ManagerDocument.ownerId. */
  ownerId: string | null;
  uploadedAt: string;
  /** The same moment as an ISO instant, for the sidebar's count of new files. */
  createdAt: string;
  /** Bytes. Rendered beneath the file name, as in the staff portals. */
  size: number;
  /** When the reader archived it, on the Archive tab's rows. */
  archivedAt: string | null;
}

export interface CustomerCompany {
  id: string;
  name: string;
  activeServices: string[];
  subscriptionDate: string | null;
  inactive: boolean;
  teamMembers: PortalPerson[];
}

export interface TeamMember {
  name: string;
  /** Their picture, when the row carries one. Null draws their initials. */
  avatarUrl: string | null;
  /** What they are on this account: Owner, Team Member, or our role for staff. */
  role: string;
  /** The customer's side's own job title. Empty for staff — see `toTeamRoster`. */
  title: string;
  /** Who they work for: the customer's own company, or `FINOPSYS`. */
  company: string;
  email: string;
}

/** Us, in the Company column. Spelled as every other screen in the portal spells it. */
export const FINOPSYS = "FinOpSys";

/**
 * Everyone on an account, from both sides of it: the customer's own people and
 * the FinOpSys staff serving them.
 *
 * ROLE AND TITLE ARE SEPARATE COLUMNS (17 Nov). Role is what the person is on
 * THIS account: Owner, Team Member, "Accounting Manager", "Bookkeeping
 * Specialist". Title is the job title the customer's side typed, the only thing
 * that distinguishes an office manager from a controller.
 *
 * STAFF HAVE NO TITLE HERE. `jobTitle` is what someone typed about their
 * career; it would have a tax specialist reading "Senior Associate" on the one
 * screen whose job is telling a customer who handles their taxes.
 *
 * Owner and staff come from `teamMembers`; the teammates are their own read,
 * because no company read carries `company_members` rows at all. Separated from
 * the fetching so the precedence above can be checked against a payload.
 */
export function toTeamRoster(
  company: BackendCompany | null,
  teammates: BackendTeammate[],
): TeamMember[] {
  const team = company?.teamMembers ?? company?.members;
  const companyName = company?.companyName ?? "";

  const row = (
    p: BackendPerson,
    role: string,
    title: string,
    employer: string,
  ): TeamMember => ({
    name: personName(p),
    avatarUrl: personAvatarUrl(p),
    role,
    title,
    company: employer,
    email: p.email ?? "",
  });

  return [
    // Their side: the one customer who signed up, then everyone they invited.
    ...(team?.owner ? [row(team.owner, "Owner", team.owner.jobTitle ?? "", companyName)] : []),
    ...teammates.map((t) => ({
      name: fullName(t),
      avatarUrl: t.avatarUrl ?? null,
      role: t.specificRoleName ?? "Team Member",
      title: t.jobTitle ?? "",
      company: companyName,
      email: t.email,
    })),
    // Ours.
    ...(team?.accountingManager
      ? [row(team.accountingManager, "Accounting Manager", "", FINOPSYS)]
      : []),
    ...(team?.specialists ?? []).map((p) =>
      row(p, specialistTitle(p) || "Specialist", "", FINOPSYS),
    ),
  ];
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
  /**
   * The companies this teammate joins. Workspace ids, i.e. company ids as
   * strings — see the note on `customerApi` — and never empty: the endpoint
   * refuses an invitation that names no company.
   */
  companyIds: string[];
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
  /**
   * The picker after sign-in: every company this person can open.
   *
   * `/companies`, NOT `/companies/owned`. The two answer different questions
   * and the picker asks the first one: `companyAccessFilter` admits an owner,
   * a company's accounting manager, an active specialist AND — since the
   * membership clause landed — an invited teammate, who holds `company_members`
   * rows and owns nothing. Pointed at `owned` this returned `[]` for every
   * teammate, which stranded them on the empty picker and 404'd
   * `CustomerLayout` on every `/customer/[workspace]` URL.
   *
   * `/companies/owned` still means OWNERSHIP and still has callers: the invite
   * dialog's Company Access checklist (`POST /invitations/teammates` refuses a
   * company the caller does not own) and the onboarding plan step. Widening it
   * to fix this screen would have handed a teammate an invite form the endpoint
   * rejects.
   *
   * Only id, name and the services paid for are read here; the rows carry a
   * whole company account each (billing, roster) and the picker draws two
   * fields.
   *
   * Memoized for the render, like `projects` below: the layout reads both for
   * the sidebar's service groups and the page under it reads them again. See
   * `fetchCompanyRows` in lib/manager for why `cache` is safe across users.
   */
  workspaces: cache(async (): Promise<Workspace[]> => {
    // ponytail: 100 is the server's own maxLimit and the picker does not page.
    // Someone on more than a hundred companies loses the remainder silently —
    // move to `?limit=&offset=` if that ever stops being absurd.
    const data = await get<{
      companies: {
        id: number;
        companyName: string;
        status?: string;
        activeServices?: { specializationName: string }[];
      }[];
    }>("/companies?limit=100");
    return data.companies.map((c) => ({
      id: String(c.id),
      name: c.companyName,
      inactive: c.status === "INACTIVE",
      services: (c.activeServices ?? []).map((s) => s.specializationName),
    }));
  }),

  /**
   * The service groups in this workspace's sidebar, in nav order. The layout
   * draws them; a list page asks again to send a URL with no `?service=` to
   * the first one.
   *
   * The two reads run together rather than the project read waiting to learn
   * whether the company is inactive. A frozen company's projects are dropped
   * here, and a refused read leaves the subscribed services: a frame that
   * renders beats a frame that throws.
   */
  async serviceGroups(workspaceId: string): Promise<ServiceTab[]> {
    const [workspaces, projects] = await Promise.all([
      customerApi.workspaces(),
      customerApi.projects(workspaceId).catch(() => []),
    ]);
    const workspace = workspaces.find((w) => w.id === workspaceId);
    return serviceGroups(
      workspace?.services ?? [],
      workspace?.inactive ? [] : projects,
    );
  },

  projects: cache(async (workspaceId: string): Promise<Project[]> => {
    // ponytail: 100 is the server's own maxLimit, and the whole set is fetched
    // in one request so the table can page it locally. Past 100 rows the
    // remainder is silently absent — move to `?limit=&offset=` per page (as the
    // admin lists do) when a workspace realistically holds that many.
    const data = await get<{ projects: BackendProject[] }>(
      `/projects?companyId=${encodeURIComponent(workspaceId)}&limit=100`,
    );
    return data.projects.map(toProject);
  }),

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

  /**
   * The project's task list, read-only. Same route the manager and specialist
   * read; the task board is company-wide by design, so the customer sees what
   * is outstanding on their own account.
   */
  async tasks(projectId: string): Promise<ProjectTask[]> {
    // ponytail: 100 is the task list's maxLimit, one page for the whole panel.
    const data = await get<{ tasks: BackendTask[] }>(
      `/projects/${encodeURIComponent(projectId)}/tasks?limit=100`,
    );
    return data.tasks.map(toProjectTask);
  },

  /** `archived` reads the customer's own archive instead of Documents. */
  async files(
    workspaceId: string,
    projectName?: string,
    archived = false,
  ): Promise<CustomerFile[]> {
    // ponytail: 100 is the server's own maxLimit, and the whole set is fetched
    // in one request so the table can page it locally. Past 100 rows the
    // remainder is silently absent — move to `?limit=&offset=` per page (as the
    // admin lists do) when a workspace realistically holds that many.
    const data = await get<{ documents: BackendDocument[] }>(
      `/documents?companyId=${encodeURIComponent(workspaceId)}${archived ? "&archived=true" : ""}&limit=100`,
    );

    const files = data.documents.map((d) => ({
      id: String(d.id),
      projectId: documentProjectId(d),
      ownerAvatarUrl: personAvatarUrl(d.uploadedBy),
      name: d.fileName,
      project: d.project?.projectName ?? "",
      owner: personName(d.uploadedBy),
      ownerId: personId(d.uploadedBy),
      uploadedAt: usDate(d.createdAt),
      createdAt: d.createdAt,
      size: d.sizeBytes,
      archivedAt: d.archivedAt ?? null,
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
      projectId: String(target.id),
      name: doc.fileName,
      project: meta.project,
      owner: personName(doc.uploadedBy),
      ownerId: personId(doc.uploadedBy),
      uploadedAt: usDate(doc.createdAt),
      createdAt: doc.createdAt,
      size: doc.sizeBytes,
      archivedAt: null,
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
      inactive: c.status === "INACTIVE",
      teamMembers: teamPeople(c),
    }));
  },

  /**
   * One company, for the row the customer clicks on the Company table.
   *
   * No Current Plans table on the page it feeds: `GET /companies/:id` answers
   * with `toCompanyAccountRow`, which carries no `servicePlans` — and what this
   * company pays already has a screen of its own at /billing, priced from the
   * subscription rather than the catalogue.
   *
   * Null is "no such company" only. Reaching one that is not yours is a 403
   * from the service's own per-company check, and that throws rather than
   * rendering as absence.
   */
  async company(id: string): Promise<ClientCompanyDetail | null> {
    // Two reads: the company row's team is owner + accounting manager +
    // specialists, so the customer's OWN colleagues — the people they invited,
    // `company_members` rows — were the one group missing from their own
    // company's panel. GET /teammates is the only route that lists them.
    const [data, teammates] = await Promise.all([
      getOrNull<{ company: BackendCompany }>(
        `/companies/${encodeURIComponent(id)}`,
      ),
      teammatePeople(id),
    ]);
    if (!data?.company) return null;

    const company = toClientCompanyDetail(data.company);
    return { ...company, teamMembers: [...company.teamMembers, ...teammates] };
  },

  async team(workspaceId: string): Promise<TeamMember[]> {
    /*
     * BOTH SIDES OF THE ACCOUNT, which is two reads.
     *
     * `/teammates` is the customer's own colleagues and nothing else — the owner
     * is linked through `companies.owner_user_id` and the staff through the
     * manager column and the assignment rows, so none of the three appear in it.
     * `/companies/:id` carries all of them in `teamMembers`, the same payload
     * the detail screens stack as faces, and it is the only read that says which
     * service line each specialist covers.
     *
     * `getOrNull` on the company: this page's reason to exist is the teammate
     * roster, and a company read that 404s must leave it standing with our half
     * missing rather than blanking the screen.
     */
    const [data, detail] = await Promise.all([
      get<{ teammates: BackendTeammate[] }>(
        `/teammates?companyId=${encodeURIComponent(workspaceId)}`,
      ),
      getOrNull<{ company: BackendCompany }>(
        `/companies/${encodeURIComponent(workspaceId)}`,
      ),
    ]);

    return toTeamRoster(detail?.company ?? null, data.teammates);
  },

  /**
   * `POST /invitations/teammates`, which is OWNER-only and takes the companies
   * the teammate joins as a list — one invitation can span several.
   *
   * NO `workspaceId`. The open workspace used to be the only company an invite
   * could name, which made inviting one person onto three accounts three
   * invitations and three sign-up emails. The companies come from the form now,
   * which offers `workspaces()` — the ones the caller owns, the same set the
   * server checks the list against before it writes anything.
   */
  async inviteTeammate(input: InviteTeammateInput): Promise<void> {
    const ids = await roleIds("CUSTOMER", "TEAM");
    await post("/invitations/teammates", {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      jobTitle: input.jobTitle,
      companyIds: input.companyIds.map(Number),
      ...ids,
    });
  },

  /**
   * The signed-in customer. Shared with every other portal — it is the same
   * record and the same endpoint for all of them; see lib/portal.
   */
  profile: myProfile,

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

  thread(workspaceId: string): Promise<ManagerThread> {
    return openThread(workspaceId);
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
};

/* ------------------------------------------------------- live helpers ---- */

function toProject(p: BackendProject): Project {
  return {
    id: String(p.id),
    name: p.projectName,
    service: p.service?.serviceName ?? "",
    deadline: p.deadlineDate ? usDate(p.deadlineDate) : "",
    status: toProjectStatus(p.status),
    specialist: p.specialist ? personName(p.specialist) : null,
    specialistAvatarUrl: personAvatarUrl(p.specialist),
    creatorId: personId(p.createdBy),
    inactive: p.isActive === false,
    previousProject: toPreviousProject(p),
    createdAt: p.createdAt,
  };
}
