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

import type { Notification } from "@/components/portal/portal-chrome";
import type { CompanyPlan } from "@/lib/admin";
import { countryCode } from "@/lib/countries";
import { fullName, isInactive } from "@/lib/directory";
import { del, get, patch } from "@/lib/http";
import { withDialCode } from "@/lib/phone";
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
import {
  toMessageReaction,
  type BackendReaction,
} from "@/lib/reactions";
import type { ProfileValues } from "@/lib/schemas";

/* ---------------------------------------------------------------- people -- */

export interface BackendPerson {
  /**
   * TWO SPELLINGS, because the backend has two. `projectDto.toPerson` — which
   * every embedded person on a project, task or document is built by — names it
   * `id`; the directory rows name it `userId`. Reading only one of them is how
   * an owner check silently compares `undefined` to a real id and answers "not
   * yours" for every row.
   */
  id?: number;
  userId?: number;
  firstName: string;
  lastName: string;
  /** Built by `projectDto.toPerson`; absent on directory rows. */
  avatarUrl?: string | null;
  /** Null when the joined row carried no address — `toPerson` always sends the key. */
  email?: string | null;
  /**
   * What this person typed about themselves at onboarding. `projectDto.toPerson`
   * sends it for everyone it builds, so every person embedded on a company team
   * carries one — but it is NOT a role, and the staff's role beats it wherever
   * the two are shown together (see `companyTitle`).
   */
  jobTitle?: string | null;
  /**
   * `UserStatus`. NOT SENT YET — `projectDto.toPerson` needs it (Pratibha #5).
   * `HIBERNATED` renders the name as "Name (inactive)" (see `fullName`).
   */
  status?: string | null;
}

export const personName = (p: BackendPerson | null | undefined): string =>
  p ? fullName(p) : "";

/** Whoever this person is, as the id the session can be compared against. */
export const personId = (p: BackendPerson | null | undefined): string | null => {
  const id = p?.id ?? p?.userId ?? null;
  return id === null ? null : String(id);
};

/**
 * Their uploaded picture, when the row carries one.
 *
 * `projectDto.toPerson` builds it for every person embedded on a project, task
 * or document, so the people those screens name can show their own face. The
 * DIRECTORY rows cannot: `companyDto.toDirectoryUser` selects no avatar, which
 * is why the admin and manager list tables still draw initials — a backend
 * change, not one that can be made here.
 */
export const personAvatarUrl = (
  p: BackendPerson | null | undefined,
): string | null => p?.avatarUrl ?? null;

/**
 * A person as the screens render one: their name, and their picture when they
 * have uploaded one.
 *
 * The pair travels together because every avatar in this portal is drawn from
 * both — `InitialsAvatar` falls back to initials on a null URL — and a row that
 * carried only the name could never show a face however many the API returned.
 */
export interface PortalPerson {
  name: string;
  avatarUrl: string | null;
}

export const toPortalPerson = (
  p: BackendPerson | null | undefined,
): PortalPerson => ({ name: personName(p), avatarUrl: personAvatarUrl(p) });

/* --------------------------------------------------------------- statuses -- */

/**
 * The backend stores four states and spells them TODO / ACTIVE / IN_REVIEW /
 * COMPLETED. One map, not one per entity: a task and a project are the same
 * states, and 1.0's two vocabularies ("To do" on a task, "Not started" on a
 * project) only taught the reader that two words meant one thing. The map goes
 * both ways because a status also travels back on a write.
 */
const STATUS: Record<string, ProjectStatus> = {
  TODO: "Not started",
  ACTIVE: "In progress",
  IN_REVIEW: "In review",
  COMPLETED: "Completed",
};

const TASK_CODE: Record<TaskStatus, string> = {
  "Not started": "TODO",
  "In progress": "ACTIVE",
  "In review": "IN_REVIEW",
  Completed: "COMPLETED",
};

export const toProjectStatus = (code: string): ProjectStatus =>
  STATUS[code] ?? "Not started";

export const toTaskStatus = (code: string): TaskStatus =>
  STATUS[code] ?? "Not started";

export const taskStatusCode = (status: TaskStatus): string =>
  TASK_CODE[status] ?? "TODO";

/** One move a status menu offers, and whether it asks for a review note. */
export interface TaskMove {
  label: string;
  to: TaskStatus;
  note?: "required" | "optional";
}

/**
 * The moves `PATCH /tasks/:id/status` accepts from this person and this state
 * (the review flow, 25 Nov). The specialist sends finished work for review and
 * can't complete it; the accounting manager approves it or sends it back, and
 * can reopen completed work. Sending back and reopening need a note.
 */
export function taskMoves(
  from: "manager" | "specialist",
  status: TaskStatus,
): TaskMove[] {
  if (status === "Not started") return [{ label: "In progress", to: "In progress" }];
  if (status === "In progress") {
    const back: TaskMove = { label: "Not started", to: "Not started" };
    return from === "specialist"
      ? [back, { label: "Send for Review", to: "In review" }]
      : [back];
  }
  // In review and Completed wait on the accounting manager.
  if (from === "specialist") return [];
  return status === "In review"
    ? [
        { label: "Approve", to: "Completed", note: "optional" },
        { label: "Send Back", to: "In progress", note: "required" },
      ]
    : [{ label: "Reopen", to: "In progress", note: "required" }];
}

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
  /**
   * The creator's switch, kept apart from `status`, so a project remembers
   * whether it was In progress or Completed. Absent reads as active.
   */
  isActive?: boolean;
  /**
   * The earlier project this one follows on from, picked when it was opened. A
   * mention only — nothing is copied or shared. NOT SENT BY ANY ROUTE TODAY
   * (Pratibha's list #4).
   */
  previousProject?: { id: number; projectName: string } | null;
}

/** A link back to the project this one follows on from. */
export interface PreviousProject {
  id: string;
  name: string;
}

export function toPreviousProject(p: BackendProject): PreviousProject | null {
  return p.previousProject
    ? { id: String(p.previousProject.id), name: p.previousProject.projectName }
    : null;
}

/**
 * Completed is final: no new tasks, uploads or status moves until the
 * accounting manager reopens it. Inactive is read-only, like past work
 * (25 Nov). Pickers that file work against a project leave both out.
 */
export const isOpenProject = (p: { status: string; inactive: boolean }): boolean =>
  p.status !== "Completed" && !p.inactive;

/**
 * Mark the rows (documents, tasks) that sit in an inactive project: they stay
 * in every list and read like past work, but nothing on them changes (25 Nov;
 * the server refuses those writes with 403). A row whose project isn't in
 * `projects` is left open.
 */
export function lockInactive<T extends { projectId: string | null }>(
  rows: T[],
  projects: { id: string; inactive: boolean }[],
): (T & { locked: boolean })[] {
  const inactive = new Set(projects.filter((p) => p.inactive).map((p) => p.id));
  return rows.map((r) => ({ ...r, locked: !!r.projectId && inactive.has(r.projectId) }));
}

/**
 * Mark Completed / Reopen — the accounting manager's call alone (15 Nov). The
 * route already exists; today it also admits the creator and the specialist,
 * which Pratibha's list #4 narrows.
 */
export async function setProjectStatus(
  projectId: string,
  status: ProjectStatus,
): Promise<void> {
  await patch(`/projects/${encodeURIComponent(projectId)}`, {
    status: taskStatusCode(status),
  });
}

export function toManagedProject(p: BackendProject): ManagedProject {
  return {
    id: String(p.id),
    name: p.projectName,
    company: p.companyName ?? "",
    companyId: String(p.companyId),
    // "Service" in the table. The specialization, not the plan tier.
    service: p.service?.serviceName ?? "",
    deadline: p.deadlineDate ? usDate(p.deadlineDate) : "",
    status: toProjectStatus(p.status),
    // Null means the service line is unstaffed — not that the field was
    // forgotten, which is why the column renders a placeholder rather than "".
    specialist: p.specialist ? personName(p.specialist) : null,
    specialistAvatarUrl: personAvatarUrl(p.specialist),
    createdBy: personName(p.createdBy),
    creatorId: personId(p.createdBy),
    inactive: p.isActive === false,
    previousProject: toPreviousProject(p),
    progress: p.progressBar ?? 0,
    createdOn: usDate(p.createdAt),
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
  /** The accounting manager's note on the latest review move only. */
  review?: {
    note: string | null;
    reviewedAt: string | null;
    reviewedBy: BackendPerson | null;
  } | null;
}

export function toProjectTask(t: BackendTask): ProjectTask {
  return {
    id: String(t.id),
    projectId: String(t.projectId),
    name: t.taskName,
    description: t.description,
    status: toTaskStatus(t.status),
    deadline: t.deadlineDate ? usDate(t.deadlineDate) : "",
    // An approval may come with no note; there is nothing to show then.
    reviewNote: t.review?.note
      ? {
          note: t.review.note,
          by: personName(t.review.reviewedBy),
          on: t.review.reviewedAt ? usDate(t.review.reviewedAt) : "",
        }
      : null,
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
  /** When the CALLER archived it: the archive is per person (25 Nov). */
  archivedAt?: string | null;
}

/**
 * The project a document hangs off, however the row spells it.
 *
 * The company-wide list nests it and the upload's confirm names it flat; either
 * is the half of the download URL that route checks the document against.
 */
export function documentProjectId(d: BackendDocument): string | null {
  const id = d.projectId ?? d.project?.id ?? null;
  return id === null ? null : String(id);
}

export function toManagerDocument(
  d: BackendDocument,
  scope: { companyId: string; companyName: string },
): ManagerDocument {
  return {
    id: String(d.id),
    projectId: documentProjectId(d),
    name: d.fileName,
    companyId: scope.companyId,
    company: scope.companyName,
    // Company-wide listings carry the project; a project's own panel does not,
    // because the heading above it already says which one.
    project: d.project?.projectName ?? null,
    owner: personName(d.uploadedBy),
    // Null when the uploader's account has been deleted — the FK is SET NULL,
    // so a file outlives its attribution. Nobody owns such a row.
    ownerId: personId(d.uploadedBy),
    ownerAvatarUrl: personAvatarUrl(d.uploadedBy),
    uploadedAt: usDate(d.createdAt),
    size: d.sizeBytes,
    archivedAt: d.archivedAt ?? null,
  };
}

/**
 * The signed-in user's own id — what "uploaded by you" is decided against.
 *
 * Read on the server, once per page, rather than threaded through every list
 * boundary: it is the same call for all four portals (`GET /users/me` answers
 * for whoever holds the token) and the rows themselves carry no viewer.
 */
export async function viewerId(): Promise<string> {
  return String((await get<{ id: number }>("/users/me")).id);
}

/**
 * Remove one document.
 *
 * ONE FUNCTION FOR EVERY PORTAL, like the chat routes: the endpoint authorizes
 * against the caller's relationship to the project rather than their role, so
 * the manager, the specialist and the customer call the identical path.
 *
 * The server's rule is broader than the button's — it also lets whoever has
 * write access to the project remove somebody else's file. The UI offers it
 * only to the uploader, which is the rule a reader can predict from the row in
 * front of them; a 403 from the wider case is still handled, because the button
 * is not the security boundary.
 */
export async function deleteDocument(
  projectId: string,
  documentId: string,
): Promise<void> {
  await del(`/projects/${projectId}/documents/${documentId}`);
}

/**
 * Delete a project with its tasks and documents, never the company (Sir, Q4).
 * Creator only (Q2).
 *
 * Today's route is a soft delete and still lets the company's accounting
 * manager in too; Pratibha's list #1 makes it permanent and creator-only.
 */
export async function deleteProject(projectId: string): Promise<void> {
  await del(`/projects/${encodeURIComponent(projectId)}`);
}

/**
 * The creator's Active switch on a project. Inactive keeps everything, moves
 * the project to the Inactive tab and makes it read-only.
 */
export async function setProjectActive(
  projectId: string,
  active: boolean,
): Promise<void> {
  await patch(`/projects/${encodeURIComponent(projectId)}/active`, {
    isActive: active,
  });
}

/** The tabs over every Projects list, in order. */
export const PROJECT_TABS = [
  { tab: "active", label: "Active" },
  { tab: "completed", label: "Completed" },
  { tab: "inactive", label: "Inactive" },
] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number]["tab"];

/** `?tab=` off the URL. Anything else is the default tab. */
export function parseProjectTab(raw: string | undefined): ProjectTab {
  return PROJECT_TABS.some((t) => t.tab === raw) ? (raw as ProjectTab) : "active";
}

/** A Projects list link on `tab`, keeping any query `path` already has. */
export function tabHref(path: string, tab: ProjectTab): string {
  if (tab === "active") return path;
  return `${path}${path.includes("?") ? "&" : "?"}tab=${tab}`;
}

/** Which tab a project sits on. Switched off beats its status. */
export function projectTab(p: { status: string; inactive: boolean }): ProjectTab {
  if (p.inactive) return "inactive";
  return p.status === "Completed" ? "completed" : "active";
}

/**
 * The services the customer's Projects and Documents lists are split by, in
 * the order every other screen names them. Each is a group in the customer's
 * sidebar and rides in `?service=`. Other holds a service with no group of its
 * own (FP&A, 1099) and a document on no project; All is the unsplit list, shown
 * only when a company has no groups at all.
 */
export const SERVICE_TABS = [
  { tab: "all", label: "All" },
  { tab: "bookkeeping", label: "Bookkeeping" },
  { tab: "payroll", label: "Payroll" },
  { tab: "tax", label: "Tax" },
  { tab: "other", label: "Other" },
] as const;

export type ServiceTab = (typeof SERVICE_TABS)[number]["tab"];

/** `?service=` off the URL. Anything else is All. */
export function parseServiceTab(raw: string | undefined): ServiceTab {
  return SERVICE_TABS.some((t) => t.tab === raw) ? (raw as ServiceTab) : "all";
}

/** A list link on `tab`, keeping any query `path` already has. */
export function serviceHref(path: string, tab: ServiceTab): string {
  if (tab === "all") return path;
  return `${path}${path.includes("?") ? "&" : "?"}service=${tab}`;
}

/** Which service tab a service line sits on, by the name the backend sends. */
export function serviceTab(service: string | null): ServiceTab {
  const key = service?.trim().toLowerCase();
  return key === "bookkeeping" || key === "payroll" || key === "tax"
    ? key
    : "other";
}

/** Whether a row belongs on `tab`. Everything is on All. */
export const onServiceTab = (
  row: { service: string | null },
  tab: ServiceTab,
): boolean => tab === "all" || serviceTab(row.service) === tab;

/**
 * The service groups in a customer's sidebar, in nav order: every service the
 * company pays for, and any it still has a project on. The second half is what
 * keeps a lapsed subscription from stranding the work done under it. Other
 * appears only when something sits on it.
 *
 * ponytail: a document on no project lives under Other, and does not by itself
 * make Other appear. The customer's upload requires a project, so only a file
 * staff attached to none can hit this; add the document list here if one does.
 */
export function serviceGroups(
  subscribed: string[],
  projects: { service: string }[],
): ServiceTab[] {
  const present = new Set(
    [...subscribed, ...projects.map((p) => p.service)].map(serviceTab),
  );
  return SERVICE_TABS.map((t) => t.tab).filter((tab) => present.has(tab));
}

/**
 * How many rows reached a list after the reader last opened it, from someone
 * else: the number beside a sidebar row. Their own uploads are not news.
 * ISO instants, so the comparison is a text one.
 */
export function newSince(
  rows: { createdAt: string; by: string | null }[],
  seen: string,
  viewer: string,
): number {
  return rows.filter((row) => row.by !== viewer && row.createdAt > seen).length;
}

/**
 * The admin's Active switch on a company (25 Nov: admin only for now).
 * Inactive hides it from the switcher, freezes everything under it and pauses
 * its billing; every record is kept.
 */
export async function setCompanyActive(
  companyId: string,
  active: boolean,
): Promise<void> {
  await patch(`/companies/${encodeURIComponent(companyId)}/status`, {
    status: active ? "ACTIVE" : "INACTIVE",
  });
}

/**
 * Delete a company and everything under it, permanently. Admin only (25 Nov).
 * The server cancels its subscription first.
 */
export async function deleteCompany(companyId: string): Promise<void> {
  await del(`/companies/${encodeURIComponent(companyId)}`);
}

/**
 * Move one document to the caller's own archive (25 Nov: the archive is per
 * person, so nobody else's list changes). Kept there with no time limit.
 */
export async function archiveDocument(
  projectId: string,
  documentId: string,
): Promise<void> {
  await patch(`/projects/${projectId}/documents/${documentId}/archive`, {
    archived: true,
  });
}

/** Back out of the caller's archive into Documents. */
export async function unarchiveDocument(
  projectId: string,
  documentId: string,
): Promise<void> {
  await patch(`/projects/${projectId}/documents/${documentId}/archive`, {
    archived: false,
  });
}

/**
 * Run `action` on several documents, one request each, and say which went.
 *
 * SETTLED, NOT ALL-OR-NOTHING: each request is its own act on the server, so a
 * refusal on the third file does not undo the first two. Reporting both lists
 * is the only honest answer, and the caller keeps the failures selected so they
 * can be tried again.
 *
 * ponytail: N requests for N files. Swap for a bulk endpoint if Portal-backend
 * grows one; the return shape stays.
 */
export async function eachDocument(
  docs: { id: string; projectId: string | null }[],
  action: (projectId: string, documentId: string) => Promise<void>,
): Promise<{ done: string[]; failed: string[] }> {
  const settled = await Promise.allSettled(
    docs.map((doc) =>
      doc.projectId
        ? action(doc.projectId, doc.id)
        : Promise.reject(new Error("No project")),
    ),
  );
  const done: string[] = [];
  const failed: string[] = [];
  settled.forEach((result, i) =>
    (result.status === "fulfilled" ? done : failed).push(docs[i].id),
  );
  return { done, failed };
}

/**
 * The toast after `eachDocument`, naming files when there are few enough to
 * read. `verb` is the past tense the toast uses — "deleted", "archived".
 */
export function documentsMessage(
  verb: string,
  done: string[],
  failed: string[],
): string {
  const files = (n: number) => `${n} ${n === 1 ? "document" : "documents"}`;
  if (failed.length === 0) {
    return done.length === 1 ? `${done[0]} ${verb}.` : `${files(done.length)} ${verb}.`;
  }
  const which = failed.length <= 3 ? `: ${failed.join(", ")}` : "";
  const lead = done.length > 0 ? `${files(done.length)} ${verb}. ` : "";
  return `${lead}${files(failed.length)} could not be ${verb}${which}.`;
}

/**
 * Where a document's bytes are, as the BROWSER asks for them.
 *
 * `/api` is the same-origin proxy, which attaches the session — so this is a
 * plain href a link or a fetch can use, with no token in the caller's hands.
 *
 * Null when the row carries no project: the route checks the document against
 * the project in its path, so a document without one cannot be read at all and
 * nothing should offer to.
 */
export function documentPath(doc: {
  id: string;
  projectId: string | null;
}): string | null {
  return doc.projectId
    ? `/api/projects/${doc.projectId}/documents/${doc.id}/download`
    : null;
}

/**
 * Join each file to its project's service line.
 *
 * A JOIN ON THE PAGE, not a field on the row, because the API never sends it:
 * `GET /documents` nests the project's name, status and deadline and nothing
 * else. Every page that renders this table already loads the project list it
 * needs for the project pill and the upload dialog, so the service costs no
 * further request — resolved on the project ID rather than its name, since the
 * staff lists span companies and two of them may name a project alike.
 *
 * ponytail: a file whose project is missing from `projects` reads "—". On the
 * specialist portal that is any file on a colleague's project, since theirs
 * lists only what is routed to them. Fix by sending the service line down on
 * the document row.
 */
export function withService<T extends { projectId: string | null }>(
  rows: T[],
  projects: { id: string; service: string }[],
): (T & { service: string | null })[] {
  const byProject = new Map(projects.map((p) => [p.id, p.service]));
  return rows.map((row) => ({
    ...row,
    // `||`, not `??`: an unnamed service line comes back as "".
    service: (row.projectId && byProject.get(row.projectId)) || null,
  }));
}


/* ------------------------------------------------------------------ chat -- */

export interface BackendMessage {
  id: number;
  conversationId: number;
  sender: BackendPerson | null;
  body: string | null;
  attachments: {
    id: number;
    fileName: string;
    sizeBytes: number;
    /** Present when the backend nests per-file reactions. See `toChatMessage`. */
    reactions?: BackendReaction[];
  }[];
  createdAt: string;
  mine: boolean | null;
  /**
   * Grouped and counted server-side, not one row per reactor. A busy message
   * would otherwise send the same emoji a dozen times for the client to tally,
   * and `mine` cannot be worked out here at all — it is the same question the
   * message's own `mine` answers, and only the server knows who is asking.
   *
   * OPTIONAL, because it is the one field on this shape that may be missing:
   * the endpoint that serves it is being built separately, and a deployment
   * without it should render a thread with no chips rather than crash.
   */
  reactions?: BackendReaction[];
  /**
   * Stamped when the sender deleted it. The message stays in the thread as a
   * tombstone rather than vanishing, which is what every chat app does and what
   * the alternative gets wrong: a bubble that silently disappears reads as a
   * bug, or worse, as the other person never having said anything.
   *
   * OPTIONAL AND, TODAY, NEVER SENT. `chatRepository.listMessages` filters
   * `deletedAt: null`, so a deleted row does not come back from the API at all
   * — see the note on `deleted` in `ChatMessage`.
   */
  deletedAt?: string | null;
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

/** The flat list's rows belonging to one file, for a backend that does not nest them. */
function onFile(m: BackendMessage, attachmentId: number): BackendReaction[] {
  return (m.reactions ?? []).filter((r) => r.attachmentId === attachmentId);
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
      // Nested if the backend sends it that way, otherwise picked out of the
      // message's flat list by `attachmentId`. Both shapes are live options —
      // see `BackendReaction.attachmentId`.
      reactions: (a.reactions ?? onFile(m, a.id)).map(toMessageReaction),
    })),
    // Grouping and counting stay the server's — `mine` is a fact about the
    // caller that no mapper here can recover. What IS done here is naming: the
    // API sends `{ reaction: "love" }`, and the chip draws a character, so each
    // row is resolved through the one table that maps the two.
    //
    // FILTERED, not passed through. A flat list carries the files' reactions
    // too, and rendering those under the bubble would put a chip on the message
    // that somebody actually put on a spreadsheet inside it.
    reactions: (m.reactions ?? [])
      .filter((r) => r.attachmentId === undefined || r.attachmentId === null)
      .map(toMessageReaction),
    deleted: Boolean(m.deletedAt),
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

/**
 * A specialist on a company's team, with the service lines they are staffed on.
 *
 * `specializations` is what `companyDto.toTeam` groups the assignment rows into
 * — one entry per service a person covers on THIS company, deduplicated by code.
 * It is the only thing in the payload that says which kind of specialist they
 * are: the team is built by `projectDto.toPerson`, which carries no
 * `specificRole`. Optional because the plain company reads
 * (`toCompanyWithPeople`) name their specialists by slot instead and send no
 * assignments at all.
 */
export interface BackendSpecialist extends BackendPerson {
  specializations?: {
    assignmentId?: number;
    specializationCode: string;
    specializationName: string | null;
  }[];
}

/** `companyDto.toTeam` — our side of an account, plus the one customer who signed up. */
export interface BackendTeam {
  owner: BackendPerson | null;
  accountingManager: BackendPerson | null;
  specialists: BackendSpecialist[];
}

export interface BackendCompany {
  id: number;
  companyName: string;
  companyEmail: string;
  /**
   * 1.0's EIN. NOT SENT BY ANY ROUTE TODAY — the backend has no column for it
   * (see docs/api.md). Read as optional so the field fills itself in the day
   * one exists, without a second pass over four detail pages.
   */
  enNumber?: string | null;
  owner: BackendPerson | null;
  accountingManager: BackendPerson | null;
  primaryAddress: BackendAddress | null;
  /**
   * What a company is paying for, UNPRICED. Every company read carries this —
   * it is the only services key `GET /companies/:id` sends.
   */
  activeServices: { specializationName: string; planName?: string | null }[];
  billing: { currentPeriodEnd: string | null } | null;
  /**
   * `CompanyStatus`. NOT SENT BY ANY ROUTE TODAY, and `INACTIVE` is not a value
   * yet — both are on Pratibha's list (#3). Absent reads as active.
   */
  status?: string;
  teamMembers?: BackendTeam;
  members?: BackendTeam;
  servicePlans?: {
    specializationName: string;
    planName: string | null;
    totalAmountMinor: number;
    currency: string;
  }[];
}

/**
 * Every date this portal prints: M/D/YYYY, always US, never the reader's locale.
 *
 * The backend speaks ISO instants; rendering one raw put
 * `2026-08-20T10:00:00.000Z` in a table cell, and leaving the locale to the
 * runtime put 20/08/2026 there for anyone outside the US. Both are the same
 * bug — the format is a product decision, not the browser's.
 */
export function usDate(value: string): string {
  // A date-only string (`deadlineDate`, "2026-09-30") is a calendar day, not
  // UTC midnight: built local, or it prints the previous day west of Greenwich.
  const [year, month, day] =
    value.length === 10 ? value.split("-").map(Number) : [];
  const date =
    year && month && day ? new Date(year, month - 1, day) : new Date(value);
  return date.toLocaleDateString("en-US");
}

/**
 * A date column's sort and filter key: its timestamp, or NaN when there is no
 * date at all.
 *
 * NaN RATHER THAN 0, which is what every caller used to fall back to
 * (`Date.parse(x) || 0`). Zero is the epoch, and the epoch is a real instant
 * earlier than any date anyone will type — so a company with no billing date
 * passed "billing date before <anything>" and showed up in a list of rows it
 * has no date to belong to. `matchesRange` already throws NaN out, and
 * `sortRows` puts it last, which is where a blank cell belongs in both
 * directions.
 */
export function dateKey(value: string | null | undefined): number {
  return value ? Date.parse(value) : NaN;
}

/**
 * The next invoice date, M/D/YYYY. Blank before checkout.
 *
 * `currentPeriodEnd` is the date the subscription next bills, which is what
 * every portal's "Next Billing Date" column shows — 1.0 called the column
 * "Billing Date" while rendering this same field, which is the only thing that
 * changed here.
 */
export function billingDate(company: BackendCompany): string | null {
  const end = company.billing?.currentPeriodEnd;
  return end ? usDate(end) : null;
}

/**
 * One row of `GET /teammates` — the customer-side roster.
 *
 * `avatarUrl` is optional because `companyDto.toTeammateRow` does not select
 * one yet, the same gap the directory rows have. Read here so the faces appear
 * the day it does, without another change.
 */
export interface BackendTeammate {
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  /**
   * Their seat in the catalog, as `specific_roles` names it. A fallback for a
   * blank job title and nothing more: every teammate is invited as CUSTOMER /
   * TEAM, so this is the SAME string for all of them and would tell a reader
   * nothing if it outranked what the owner typed.
   */
  specificRoleName?: string | null;
  email: string;
  avatarUrl?: string | null;
}

/**
 * The company's people, pictures included.
 *
 * `toTeam` builds every one of them through `projectDto.toPerson`, which
 * carries `avatarUrl` — so the stacks these feed show faces for anyone who has
 * uploaded one, and initials for everyone else.
 */
export function teamPeople(company: BackendCompany): PortalPerson[] {
  const team = company.teamMembers ?? company.members;
  return [team?.owner, team?.accountingManager, ...(team?.specialists ?? [])]
    .filter((p): p is BackendPerson => Boolean(p))
    .map(toPortalPerson);
}

/**
 * What a specialist is called: the service lines they are staffed on, as titles.
 *
 * "Bookkeeping" + " Specialist", built from `specializationName` rather than
 * from the `SPECIALIST_1`…`_4` codes the profile cards map, because the team
 * payload carries assignments and no specific role. A person staffed on two
 * services gets both, joined — the alternative is picking one arbitrarily and
 * telling half the readers the wrong thing.
 *
 * Empty when nothing is staffed, which is a real state: `toTeam` keys the map on
 * `specialistUserId`, so an assignment whose specialization join did not load
 * still yields a person with no specializations at all.
 */
export function specialistTitle(p: BackendSpecialist): string {
  return (p.specializations ?? [])
    .map((s) => s.specializationName)
    .filter((n): n is string => Boolean(n))
    .map((n) => `${n} Specialist`)
    .join(", ");
}

/**
 * The customer's OWN people on a company — the teammates its owner invited.
 *
 * NOT ON ANY COMPANY READ. `toTeam` (and `toCompanyMembers` behind the
 * manager's list) builds a team out of `companies.owner_user_id`, the
 * accounting manager and the specialist assignments — staff, plus the one
 * customer who signed up. Everyone the owner invited afterwards is a
 * `company_members` row, and `GET /teammates` is the only route that lists
 * them: so a company with five colleagues on it showed three faces on every
 * detail screen, all of them ours.
 *
 * Read access is the company's, not the roster's: its owner, an ADMIN, its
 * accounting manager, or an assigned specialist (`assertReadAccess`).
 *
 * Swallowed on failure BY DESIGN. This is a second request for a stack of
 * faces; a page that names the company and its plans must not 500 because the
 * roster was slow or the caller may not read it.
 */
export async function teammatePeople(companyId: string): Promise<PortalPerson[]> {
  try {
    const data = await get<{ teammates: BackendTeammate[] }>(
      `/teammates?companyId=${encodeURIComponent(companyId)}`,
    );
    return data.teammates.map((t) => ({
      name: fullName(t),
      avatarUrl: t.avatarUrl ?? null,
    }));
  } catch {
    return [];
  }
}

/**
 * The same company rows, each team completed with the customer's own people.
 *
 * The Team Members column draws `teamMembers`, which every company read builds
 * from the owner, the accounting manager and the specialist assignments — our
 * side of the account. The colleagues the owner invited are `company_members`
 * rows that no company read carries at all, so a five-person client showed
 * three faces and all three were staff.
 *
 * Generic over the row because the three tables that draw this column carry
 * three different company shapes; all any of them needs is an id and a team.
 *
 * ponytail: ONE REQUEST PER ROW. Cheap where it is used — the manager's and
 * specialist's tables are scoped to the switcher's company, so it is one, and a
 * customer owns a handful — and
 * `http.ts` caps the whole portal at eight in flight, so an unscoped book of
 * eight is one wave rather than a pile-up. A teammate COUNT on the company row
 * (the backend already states `teamMemberCount` for the staff) is the fix if
 * this is ever wanted on the admin's cross-company table, where the page holds
 * a hundred rows.
 */
export async function withTeammates<
  T extends { id: string; teamMembers: PortalPerson[] },
>(companies: T[]): Promise<T[]> {
  return Promise.all(
    companies.map(async (company) => ({
      ...company,
      teamMembers: [
        ...company.teamMembers,
        ...(await teammatePeople(company.id)),
      ],
    })),
  );
}

/**
 * A company that Needs Reassignment (17 Nov): its accounting manager or a
 * specialist on it was made Inactive. `detail` says who, worded once for the
 * popup, the bell and the company page alike.
 */
export interface Reassignment {
  companyId: string;
  company: string;
  detail: string;
  /** Who left the slot, for the faces on the reminder popup. */
  people: PortalPerson[];
}

/** Dispatched on `window` by the bell's reassignment row; ReassignNotice opens on it. */
export const REASSIGN_OPEN_EVENT = "reassign:open";

/**
 * The bell's ONE row for every company that Needs Reassignment.
 *
 * It was a row per company, so one person made Inactive filled the bell with
 * ten identical lines and pushed the messages below the fold. Grouped, it is a
 * single reminder whose count is the companies left, and it reopens the popup
 * that "Later" closed — the list with a Reassign button per company.
 *
 * `role` is what each company needs: "accounting manager" or "specialist".
 */
export function reassignmentNotifications(
  items: Reassignment[],
  role: string,
): Notification[] {
  if (items.length === 0) return [];
  const count = items.length;
  return [
    {
      id: "reassign",
      href: "",
      event: REASSIGN_OPEN_EVENT,
      company: items.map((r) => r.company).join(", "),
      contact: "Needs Reassignment",
      preview:
        count === 1
          ? `1 company needs a new ${role}.`
          : `${count} companies need a new ${role}.`,
      unread: count,
      when: "",
    },
  ];
}

/**
 * The company's Inactive specialists, one line each with the services they
 * held: "Bookkeeping, Payroll · Jane Doe (inactive)". The accounting manager
 * reassigns per company, and the line says which services need someone.
 */
export function inactiveSpecialists(company: BackendCompany): string[] {
  const team = company.teamMembers ?? company.members;
  return (team?.specialists ?? []).filter(isInactive).map((p) => {
    const services = (p.specializations ?? [])
      .map((s) => s.specializationName)
      .filter(Boolean)
      .join(", ");
    return services ? `${services} · ${personName(p)}` : personName(p);
  });
}

/** Just the staffed specialists — the Assigned Specialists cell names them once they exist. */
export function specialistNames(company: BackendCompany): string[] {
  const team = company.teamMembers ?? company.members;
  return (team?.specialists ?? []).map(personName);
}

export function toClientCompany(c: BackendCompany): ClientCompany {
  return {
    id: String(c.id),
    name: c.companyName,
    owner: personName(c.owner),
    ownerAvatarUrl: personAvatarUrl(c.owner),
    activeServices: (c.activeServices ?? []).map((s) => s.specializationName),
    billingDate: billingDate(c),
    inactive: c.status === "INACTIVE",
    teamMembers: teamPeople(c),
    specialists: specialistNames(c),
    inactiveSpecialists: inactiveSpecialists(c),
    inactivePeople: (c.teamMembers ?? c.members)?.specialists
      .filter(isInactive)
      .map(toPortalPerson) ?? [],
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

/* --------------------------------------------------------------- profile -- */

/**
 * The signed-in person's own record, whichever portal is asking.
 *
 * ONE SHAPE FOR ALL OF THEM. `GET /users/me` answers for whoever holds the
 * token and the customer's, the manager's and the specialist's profile screens
 * render the same fields off it — so this is one type, one read, one write.
 * It is also the same row the ADMIN reads back through `GET /customers/:id`
 * and the manager through the directory: a change saved here is a change on
 * the record every other portal renders, not a second copy of it.
 */
export interface MyProfile {
  fullName: string;
  email: string;
  phone: string;
  /** `userDto.toMe` builds this from the stored key. Null when none is set. */
  avatarUrl: string | null;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export async function myProfile(): Promise<MyProfile> {
  const me = await get<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    address: BackendAddress | null;
  }>("/users/me");

  return {
    fullName: fullName(me),
    email: me.email,
    // With the dialling code of the country on the profile; legacy rows hold
    // national digits alone. The form strips it again for the field.
    phone: withDialCode(me.phone ?? "", me.address?.country ?? ""),
    avatarUrl: me.avatarUrl ?? null,
    ...toAddressFields(me.address),
  };
}

/**
 * The address as `PATCH /users/me` takes it — `zip` is `postalCode` there, and
 * the country code is required alongside the name. Its own function so the
 * rename is asserted in portal.test.ts rather than discovered as a 400.
 */
export function toAddressPayload(values: ProfileValues) {
  return {
    addressLine1: values.addressLine1,
    city: values.city,
    state: values.state,
    postalCode: values.zip,
    country: values.country,
    countryCode: countryCode(values.country),
  };
}

/**
 * `PATCH /users/me`. It accepts phone and address and nothing else — name and
 * email are not the caller's to change here.
 *
 * NO ROLE GATE on the route (userRoutes.js says so deliberately: "me" is the
 * token's subject), so this is the identical write from every portal. The
 * address goes whole, never field by field: a half-updated address is worse
 * than requiring all of it.
 */
export async function saveMyProfile(values: ProfileValues): Promise<void> {
  await patch("/users/me", {
    // Stored with its dialling code. The field holds national digits beside a
    // country picker, and only the digits used to be sent — see `withDialCode`.
    phone: withDialCode(values.phone, values.country),
    address: toAddressPayload(values),
  });
}

/** Minor units to the string a plans table renders — "$249/month". */
export function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

/**
 * The Current Plans table, from whichever half of the fact the endpoint sent.
 *
 * TWO KEYS, AND ONLY ONE ENDPOINT SENDS THE PRICED ONE. `servicePlans` — per
 * line, at the amount captured at purchase — is built by `toManagedCompany` and
 * therefore reaches exactly one route: `GET /accounting-manager/companies`. The
 * DETAIL route every company page reads, `GET /companies/:id`, answers with
 * `toCompanyAccountRow`, which carries `activeServices` and no prices at all.
 *
 * Reading only the priced key rendered an EMPTY TABLE on every company detail
 * screen — headers, no rows — on companies that were plainly subscribed, because
 * the key it looked for had never been in that response. The unpriced list is
 * the same services with the same plan names, so it renders those and prints "—"
 * for the money that was genuinely not sent, rather than nothing at all.
 *
 * Nothing here is Stripe: both come from `company_subscription_items` rows
 * written at checkout. A blank table means the field is missing or the company
 * has no ACTIVE subscription — never that a Stripe call failed.
 */
export function toPlans(c: BackendCompany): CompanyPlan[] {
  if (c.servicePlans?.length) {
    return c.servicePlans.map((p) => ({
      service: p.specializationName,
      plan: p.planName ?? "—",
      amount: `${money(p.totalAmountMinor, p.currency)}/month`,
    }));
  }

  return (c.activeServices ?? []).map((s) => ({
    service: s.specializationName,
    plan: s.planName ?? "—",
    amount: "—",
  }));
}

export function toClientCompanyDetail(c: BackendCompany): ClientCompanyDetail {
  return {
    ...toClientCompany(c),
    email: c.companyEmail,
    // Blank until the backend stores one — never a stand-in value, because a
    // number that is not an EIN printed where an EIN goes is worse than a dash.
    enNumber: c.enNumber ?? "",
    ...toAddressFields(c.primaryAddress),
    plans: toPlans(c),
  };
}
