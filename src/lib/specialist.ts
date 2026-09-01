/**
 * Specialist portal API boundary.
 *
 * A specialist works the projects an accounting manager routes to them, so
 * every list here is the shared endpoint narrowed to one person by the session.
 */

import {
  listDocuments,
  managerApi,
  openConversation,
  sendChatAttachment,
  sendEmailAs,
  uploadCompanyDocument,
  type ChatMessage,
  type ClientCompany,
  type ClientCompanyDetail,
  type ManagedProject,
  type ManagerDocument,
  type ManagerProfile,
  type ManagerThread,
  type ProjectTask,
  type SpecialistDetail,
  type SpecialistTask,
  type TaskStatus,
} from "@/lib/manager";
import { get, getOrNull, patch } from "@/lib/http";
import { fullName } from "@/lib/directory";
import {
  personName,
  taskStatusCode,
  toAddressFields,
  toClientCompany,
  toClientCompanyDetail,
  toManagedProject,
  toProjectTask,
  toSpecialistTask,
  type BackendCompany,
  type BackendProject,
  type BackendTask,
} from "@/lib/portal";

export type { ManagerThread };

/**
 * EVERY LIST HERE IS THE SHARED ENDPOINT, SCOPED BY THE SESSION — BUT NOT ALL
 * OF THEM NARROW TO THIS PERSON, AND THE DIFFERENCE IS NOT COSMETIC.
 *
 * There is no `/specialist/*` namespace and there never was. `GET /companies`
 * and `GET /projects` answer with what the CALLER holds: the companies where
 * they have an ACTIVE assignment, and on each one only the projects routed to
 * them (`projectService.listProjects` calls `scopeToOwnWork` for exactly this).
 *
 * `GET /tasks` and `GET /documents` do NOT. Both grant the whole company to
 * anyone on the account — `projectTaskService.listCompanyTasks` says so in
 * as many words, because the same endpoint serves the client looking at what is
 * outstanding on their own account. Narrowing the task board is the CALLER's
 * job, via `?specialistUserId=`, and it is done in `allTasks` below.
 */
async function myCompanies(): Promise<BackendCompany[]> {
  const data = await get<{ companies: BackendCompany[] }>(
    "/companies?limit=100",
  );
  return data.companies;
}

/** The signed-in specialist's own id, for the filters that need naming. */
async function myUserId(): Promise<number> {
  return (await get<{ id: number }>("/users/me")).id;
}

async function scopeIds(companyId?: string): Promise<string[]> {
  if (companyId) return [companyId];
  return (await myCompanies()).map((c) => String(c.id));
}

/**
 * The company every screen reads under: the one on the URL, or the first the
 * specialist works when the URL carries none.
 *
 * Same rule as the manager's `companyScope` — the switcher has no "all
 * companies" entry, so a page always has one company to ask about.
 */
export async function companyScope(
  companyId?: string,
): Promise<string | undefined> {
  return companyId ?? (await specialistApi.companies())[0]?.id;
}

export const specialistApi = {
  /** The signed-in specialist. The session decides who that is, not the caller. */
  async profile(): Promise<SpecialistDetail> {
    const [me, projects] = await Promise.all([
      get<{
        firstName: string;
        lastName: string;
        email: string;
        phone: string | null;
        specificRole: string | null;
        avatarUrl: string | null;
        address: Parameters<typeof toAddressFields>[0];
      }>("/users/me"),
      specialistApi.projects(),
    ]);

    const a = toAddressFields(me.address);
    return {
      name: fullName(me),
      email: me.email,
      avatarUrl: me.avatarUrl ?? null,
      // The role code is the speciality; the display name lives on /roles and
      // is not worth a second request for one line of a profile card.
      speciality: SPECIALITY[me.specificRole ?? ""] ?? "",
      activeProjects: projects.length,
      phone: me.phone ?? "",
      address: [a.addressLine1, a.city, a.state, a.zip].filter(Boolean).join(", "),
    };
  },

  /**
   * The accounting manager they report to — their only counterparty.
   *
   * SCOPED WHEN THE CALLER NAMES A COMPANY. A specialist works several, each
   * with its own manager, so "the first company that has one" is the right
   * answer only on screens with no company in hand. Unscoped keeps that
   * fallback rather than returning nobody.
   */
  async manager(companyId?: string): Promise<ManagerProfile> {
    const companies = await myCompanies();
    const am = (
      companyId
        ? companies.find((c) => String(c.id) === companyId)
        : companies.find((c) => c.accountingManager)
    )?.accountingManager;
    return {
      name: personName(am),
      email: am?.email ?? "",
      // Neither is on the joined person. A manager's number is theirs to share,
      // and `companyDto` carries no picture.
      phone: "",
      avatarUrl: null,
    };
  },

  /** Companies they are working for, i.e. hold an assignment on. */
  async companies(): Promise<ClientCompany[]> {
    return (await myCompanies()).map(toClientCompany);
  },

  /** `data: { company }`, not the row — read a level too high and every field renders empty. */
  async company(id: string): Promise<ClientCompanyDetail | null> {
    const data = await getOrNull<{ company: BackendCompany }>(
      `/companies/${encodeURIComponent(id)}`,
    );
    return data?.company ? toClientCompanyDetail(data.company) : null;
  },

  /** Projects assigned to them, optionally narrowed to one company. */
  async projects(companyId?: string): Promise<ManagedProject[]> {
    const ids = await scopeIds(companyId);
    const pages = await Promise.all(
      ids.map(async (id) => {
        const data = await get<{ projects: BackendProject[] }>(
          `/projects?companyId=${encodeURIComponent(id)}&limit=100`,
        );
        return data.projects.map(toManagedProject);
      }),
    );
    return pages.flat();
  },

  /** One project. Null when it is not theirs — not-found and not-yours look alike. */
  async project(id: string): Promise<ManagedProject | null> {
    // `getOrNull`, not `.catch(() => null)`. That swallowed everything — a 403,
    // a dead backend, and now the redirect an unauthenticated server read
    // raises, which would have turned "please log in" into "no such project".
    const row = await getOrNull<BackendProject>(
      `/projects/${encodeURIComponent(id)}`,
    );
    return row ? toManagedProject(row) : null;
  },

  async tasks(projectId: string): Promise<ProjectTask[]> {
    // ponytail: 100 is the task list's maxLimit, one page for the whole panel.
    const data = await get<{ tasks: BackendTask[] }>(
      `/projects/${encodeURIComponent(projectId)}/tasks?limit=100`,
    );
    return data.tasks.map(toProjectTask);
  },

  /**
   * Every task across every project they hold. The Tasks page.
   *
   * `?specialistUserId=` is what makes that sentence true. `GET /tasks` is the
   * company's whole board by design, so without the filter this page showed a
   * bookkeeping specialist the tax project's tasks — work the projects list on
   * the next tab deliberately refuses to name to them.
   */
  async allTasks(companyId?: string): Promise<SpecialistTask[]> {
    const [ids, me] = await Promise.all([scopeIds(companyId), myUserId()]);
    const pages = await Promise.all(
      ids.map(async (id) => {
        const data = await get<{ tasks: BackendTask[] }>(
          `/tasks?companyId=${encodeURIComponent(id)}&specialistUserId=${me}&limit=100`,
        );
        return data.tasks.map(toSpecialistTask);
      }),
    );
    return pages.flat();
  },

  /**
   * Add a task to one of their own projects.
   *
   * Identical to the manager's call — a task belongs to a project and the
   * project carries the person, so a specialist adding one on their own project
   * is already assigning it to themselves.
   */
  addTask(
    projectId: string,
    task: { name: string; description: string; deadline: string },
  ): Promise<void> {
    return managerApi.addTask(projectId, task);
  },

  setTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    return patch(`/tasks/${encodeURIComponent(taskId)}/status`, {
      status: taskStatusCode(status),
    });
  },

  /** Files on their companies, optionally one project's. */
  async documents(
    companyId?: string,
    project?: string,
  ): Promise<ManagerDocument[]> {
    const names = new Map(
      (await myCompanies()).map((c) => [String(c.id), c.companyName]),
    );
    return listDocuments(companyId, project, names);
  },

  /**
   * Attach a file to one of their companies, optionally to one of its
   * projects. The uploader is the session, never a client-supplied name.
   */
  uploadDocument(
    file: File,
    meta: { companyId: string; project: string | null },
  ): Promise<ManagerDocument> {
    return uploadCompanyDocument(file, meta);
  },

  /**
   * The thread with the accounting manager OF ONE COMPANY.
   *
   * `companyId` is not optional decoration. A specialist's book spans companies
   * and each one has its own manager, so there is a thread per company — and
   * every call here used to take `scopeIds()[0]`, the first company the
   * directory happened to return. A manager writing about the second one sent
   * into a thread the specialist's screen never opened: the reply went to the
   * wrong person's window and the right one stayed empty.
   *
   * Unscoped still falls back to the first company — the same default the
   * switcher shows before anything is picked — because one pane cannot show
   * two threads.
   */
  async thread(companyId?: string): Promise<ManagerThread> {
    const [id] = await scopeIds(companyId);
    if (!id) return { id: null, contact: "", unread: 0 };

    const conversation = await openConversation(id);
    return {
      id: String(conversation.id),
      contact: personName(conversation.counterpart),
      unread: conversation.unreadCount ?? 0,
    };
  },

  async messages(companyId?: string): Promise<ChatMessage[]> {
    const id = await threadId(companyId);
    if (!id) return [];
    return managerApi.messages(id);
  },

  async sendMessage(body: string, companyId?: string): Promise<ChatMessage> {
    const id = await threadId(companyId);
    if (!id) throw new Error("No company to message about.");
    return managerApi.sendMessage(id, body);
  },

  async sendAttachment(file: File, companyId?: string): Promise<ChatMessage> {
    const id = await threadId(companyId);
    if (!id) throw new Error("No company to message about.");
    return sendChatAttachment(id, file);
  },

  async sendEmail(input: {
    to: string;
    subject: string;
    message: string;
    companyId?: string;
  }): Promise<void> {
    const companyId = input.companyId ?? (await scopeIds())[0];
    await sendEmailAs({ ...input, companyId });
  },
};

/** Specific-role codes to the titles the profile card renders. */
const SPECIALITY: Record<string, string> = {
  SPECIALIST_1: "Payroll Specialist",
  SPECIALIST_2: "Tax Specialist",
  SPECIALIST_3: "Bookkeeping Specialist",
  SPECIALIST_4: "FP&A Specialist",
};

async function threadId(companyId?: string): Promise<string | null> {
  const [id] = await scopeIds(companyId);
  if (!id) return null;
  return String((await openConversation(id)).id);
}
