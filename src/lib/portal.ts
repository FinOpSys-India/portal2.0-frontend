/**
 * The backend's row shapes, and the translation into what the portals render.
 *
 * WHY THIS FILE EXISTS. The three portal boundaries — manager, specialist,
 * customer — each invented their own namespace (`/manager/projects`,
 * `/specialist/projects`, `/customer/projects`) and none of them existed. The
 * real API has ONE projects endpoint, one tasks endpoint, one documents
 * endpoint, scoped server-side by the caller's role and narrowed by
 * `?companyId=`. Three portals reading one endpoint means one adapter, not
 * three copies that drift.
 *
 * Everything here is a pure function of a response body, so it is testable
 * without a server — which matters, because these mappings are where a wrong
 * field name fails silently rather than loudly.
 */

import type { CompanyPlan } from "@/lib/admin";
import { fullName } from "@/lib/directory";
import type {
  ChatMessage,
  ClientCompany,
  ClientCompanyDetail,
  ManagedProject,
  ManagerDocument,
  ProjectStatus,
  ProjectTask,
  SpecialistTask,
  TaskStatus,
} from "@/lib/manager";

/* ---------------------------------------------------------------- people -- */

export interface BackendPerson {
  userId?: number;
  firstName: string;
  lastName: string;
  /** Null when the joined row carried no address — `toPerson` always sends the key. */
  email?: string | null;
}

export const personName = (p: BackendPerson | null | undefined): string =>
  p ? fullName(p) : "";

/* --------------------------------------------------------------- statuses -- */

/**
 * The backend stores three states and spells them TODO / ACTIVE / COMPLETED.
 * The screens have said "Not started" / "In progress" / "Completed" since 1.0
 * for projects, and "To do" / "In progress" / "Completed" for tasks — the same
 * three states under two vocabularies, which is why the maps go both ways.
 */
const PROJECT_STATUS: Record<string, ProjectStatus> = {
  TODO: "Not started",
  ACTIVE: "In progress",
  COMPLETED: "Completed",
};

const TASK_STATUS: Record<string, TaskStatus> = {
  TODO: "To do",
  ACTIVE: "In progress",
  COMPLETED: "Completed",
};

const TASK_CODE: Record<TaskStatus, string> = {
  "To do": "TODO",
  "In progress": "ACTIVE",
  Completed: "COMPLETED",
};

export const toProjectStatus = (code: string): ProjectStatus =>
  PROJECT_STATUS[code] ?? "Not started";

export const toTaskStatus = (code: string): TaskStatus =>
  TASK_STATUS[code] ?? "To do";

export const taskStatusCode = (status: TaskStatus): string =>
  TASK_CODE[status] ?? "TODO";

/* -------------------------------------------------------------- projects -- */

export interface BackendProject {
  id: number;
  projectName: string;
  deadlineDate: string | null;
  description: string | null;
  companyId: number;
  companyName: string | null;
  service: { serviceName: string; serviceCode: string; servicePlanId: number } | null;
  specialist: BackendPerson | null;
  createdBy: BackendPerson | null;
  status: string;
  progressBar: number;
  createdAt: string;
}

export function toManagedProject(p: BackendProject): ManagedProject {
  return {
    id: String(p.id),
    name: p.projectName,
    company: p.companyName ?? "",
    companyId: String(p.companyId),
    // "Service Type" in the table. The specialization, not the plan tier.
    service: p.service?.serviceName ?? "",
    deadline: p.deadlineDate ?? "",
    status: toProjectStatus(p.status),
    // Null means the service line is unstaffed — not that the field was
    // forgotten, which is why the column renders a placeholder rather than "".
    specialist: p.specialist ? personName(p.specialist) : null,
    createdBy: personName(p.createdBy),
    progress: p.progressBar ?? 0,
    createdOn: p.createdAt,
  };
}

/* ----------------------------------------------------------------- tasks -- */

export interface BackendTask {
  id: number;
  projectId: number;
  project: { id: number; projectName: string } | null;
  companyId: number | null;
  companyName: string | null;
  taskName: string;
  description: string;
  status: string;
  deadlineDate: string | null;
}

export function toProjectTask(t: BackendTask): ProjectTask {
  return {
    id: String(t.id),
    projectId: String(t.projectId),
    name: t.taskName,
    description: t.description,
    status: toTaskStatus(t.status),
    deadline: t.deadlineDate ?? "",
  };
}

export function toSpecialistTask(t: BackendTask): SpecialistTask {
  return { ...toProjectTask(t), project: t.project?.projectName ?? "" };
}

/* ------------------------------------------------------------- documents -- */

export interface BackendDocument {
  id: number;
  projectId: number | null;
  fileName: string;
  sizeBytes: number;
  uploadedBy: BackendPerson | null;
  createdAt: string;
  project?: { id: number; projectName: string } | null;
}

export function toManagerDocument(
  d: BackendDocument,
  scope: { companyId: string; companyName: string },
): ManagerDocument {
  return {
    id: String(d.id),
    name: d.fileName,
    companyId: scope.companyId,
    company: scope.companyName,
    // Company-wide listings carry the project; a project's own panel does not,
    // because the heading above it already says which one.
    project: d.project?.projectName ?? null,
    owner: personName(d.uploadedBy),
    uploadedAt: d.createdAt,
    size: d.sizeBytes,
  };
}

/* ------------------------------------------------------------------ chat -- */

export interface BackendMessage {
  id: number;
  conversationId: number;
  sender: BackendPerson | null;
  body: string | null;
  attachments: { id: number; fileName: string; sizeBytes: number }[];
  createdAt: string;
  mine: boolean | null;
}

export interface BackendConversation {
  id: number;
  companyId: number;
  companyName: string | null;
  participantKind: string;
  counterpart: BackendPerson | null;
  lastMessageAt: string | null;
  lastMessage: BackendMessage | null;
  unreadCount: number;
}

export function toChatMessage(m: BackendMessage): ChatMessage {
  return {
    id: String(m.id),
    // `mine` is null only when the server was not told who is viewing, which
    // cannot happen on an authenticated read.
    mine: m.mine ?? false,
    // Null body means the message carried only files — the bubble renders the
    // attachments and no empty line.
    body: m.body ?? "",
    sentAt: m.createdAt,
    // The id is kept: it is the only handle on the bytes, which sit in a
    // private bucket behind a signed link minted on demand.
    attachments: (m.attachments ?? []).map((a) => ({
      id: a.id,
      name: a.fileName,
      size: a.sizeBytes,
    })),
  };
}

/* ------------------------------------------------------------- companies -- */

/**
 * An address as the backend writes it out.
 *
 * `addressLine1`, NOT `line1`. Both `companyDto.toAddress` and
 * `userDto.toAddress` rename the column on the way out (`addressLine1:
 * address.line1`), and this type named the COLUMN rather than the field — so
 * every street line read `undefined` and rendered blank while city, state, ZIP
 * and country, whose names happen to match, all arrived. Four fields out of
 * five looking right is exactly why nobody spotted it.
 */
export interface BackendAddress {
  addressLine1: string | null;
  addressLine2?: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface BackendCompany {
  id: number;
  companyName: string;
  companyEmail: string;
  owner: BackendPerson | null;
  accountingManager: BackendPerson | null;
  primaryAddress: BackendAddress | null;
  activeServices: { specializationName: string }[];
  billing: { currentPeriodEnd: string | null } | null;
  teamMembers?: {
    owner: BackendPerson | null;
    accountingManager: BackendPerson | null;
    specialists: BackendPerson[];
  };
  members?: {
    owner: BackendPerson | null;
    accountingManager: BackendPerson | null;
    specialists: BackendPerson[];
  };
  servicePlans?: {
    specializationName: string;
    planName: string | null;
    totalAmountMinor: number;
    currency: string;
  }[];
}

/** M/D/YYYY, matching the "Billing Date" column since 1.0. Blank before checkout. */
export function billingDate(company: BackendCompany): string | null {
  const end = company.billing?.currentPeriodEnd;
  return end ? new Date(end).toLocaleDateString("en-US") : null;
}

export function teamNames(company: BackendCompany): string[] {
  const team = company.teamMembers ?? company.members;
  return [team?.owner, team?.accountingManager, ...(team?.specialists ?? [])]
    .filter((p): p is BackendPerson => Boolean(p))
    .map(personName);
}

/** Just the staffed specialists — the Action cell names them once they exist. */
export function specialistNames(company: BackendCompany): string[] {
  const team = company.teamMembers ?? company.members;
  return (team?.specialists ?? []).map(personName);
}

export function toClientCompany(c: BackendCompany): ClientCompany {
  return {
    id: String(c.id),
    name: c.companyName,
    owner: personName(c.owner),
    activeServices: (c.activeServices ?? []).map((s) => s.specializationName),
    billingDate: billingDate(c),
    teamMembers: teamNames(c),
    specialists: specialistNames(c),
  };
}

export function toAddressFields(a: BackendAddress | null | undefined) {
  return {
    addressLine1: a?.addressLine1 ?? "",
    city: a?.city ?? "",
    state: a?.state ?? "",
    zip: a?.postalCode ?? "",
    country: a?.country ?? "",
  };
}

/** Minor units to the string a plans table renders — "$249/month". */
export function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export function toPlans(c: BackendCompany): CompanyPlan[] {
  return (c.servicePlans ?? []).map((p) => ({
    service: p.specializationName,
    plan: p.planName ?? "—",
    amount: `${money(p.totalAmountMinor, p.currency)}/month`,
  }));
}

export function toClientCompanyDetail(c: BackendCompany): ClientCompanyDetail {
  return {
    ...toClientCompany(c),
    email: c.companyEmail,
    // 1.0's EIN field. The Node schema has no column for it, so it stays blank
    // rather than being filled with something that is not an EIN.
    enNumber: "",
    ...toAddressFields(c.primaryAddress),
    plans: toPlans(c),
  };
}
