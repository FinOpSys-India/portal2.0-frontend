"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  FolderKanban,
  Pencil,
  Snowflake,
  Trash2,
} from "lucide-react";
import { useForm } from "react-hook-form";

import { DateField, SubmitButton, TextField } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import {
  HoldDeleteDialog,
  ProjectDeleteWarning,
} from "@/components/portal/delete-documents";
import { Face, Handover, Settle, Side } from "@/components/portal/handover";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { isoDate, tomorrow } from "@/lib/dates";
import { adminApi } from "@/lib/admin";
import { ApiError } from "@/lib/http";
import { editProject } from "@/lib/manager";
import { editProjectSchema, type EditProjectValues } from "@/lib/schemas";
import {
  deleteCompany,
  deleteProject,
  setCompanyActive,
  setProjectActive,
  setProjectStatus,
} from "@/lib/portal";

/**
 * What a frozen record shows in place of its contents (16 Nov): an inactive
 * company or project keeps its name on screen, and nothing inside it opens.
 */
export function FrozenNotice({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <Snowflake className="size-6 text-muted-foreground" aria-hidden />
      <p className="max-w-md text-sm text-muted-foreground">{children}</p>
    </section>
  );
}

/** A frozen project's page body: why nothing opens, and who can change that. */
export function FrozenProject({
  companyInactive,
  creator,
}: {
  companyInactive: boolean;
  creator: boolean;
}) {
  return (
    <FrozenNotice>
      {companyInactive
        ? "This company is inactive, so nothing under it can be opened until its owner makes it active again."
        : creator
          ? "This project is inactive, so its tasks and documents can’t be opened. Make it active to open them again."
          : "This project is inactive, so its tasks and documents can’t be opened until its creator makes it active again."}
    </FrozenNotice>
  );
}

/** A 404 from a route Portal-backend hasn't grown yet reads as that, not as "not found". */
function failure(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 404) {
    return "This isn’t available yet. Try again once the server supports it.";
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * An Active switch on a company or project page. Off asks once, with
 * `warning` saying what Inactive does; on is immediate. Nothing is deleted
 * either way.
 */
function ActiveSwitch({
  name,
  inactive,
  warning,
  onSave,
  compact = false,
  activeToast,
}: {
  name: string;
  inactive: boolean;
  warning: string;
  onSave: (active: boolean) => Promise<void>;
  /** Said after switching on, when that does not make it active straight away. */
  activeToast?: string;
  /** A table row's icon button instead of the labeled switch. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function save(active: boolean) {
    setPending(true);
    try {
      await onSave(active);
      toast.success(
        active
          ? (activeToast ?? `${name} is active again.`)
          : `${name} is now inactive.`,
      );
      setConfirming(false);
      router.refresh();
    } catch (err) {
      toast.error(failure(err, `${name} could not be changed.`));
    } finally {
      setPending(false);
    }
  }

  const toggle = () => (inactive ? save(true) : setConfirming(true));

  return (
    <>
      {/* One switch, two sizes: a table row's has no label, so it sits in
          the Actions column beside Delete (17 Nov). */}
      <button
        type="button"
        role="switch"
        aria-checked={!inactive}
        aria-label={compact ? `${name} is ${inactive ? "inactive" : "active"}` : undefined}
        title={compact ? (inactive ? "Make Active" : "Make Inactive") : undefined}
        disabled={pending}
        onClick={toggle}
        className={
          compact
            ? "relative z-10 inline-flex size-8 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-wait disabled:opacity-60"
            : "inline-flex items-center gap-2 text-sm font-medium outline-none disabled:cursor-wait"
        }
      >
        <span
          aria-hidden
          className={`relative rounded-full transition-colors duration-150 ${
            compact ? "h-4 w-7" : "h-5 w-9"
          } ${inactive ? "bg-muted-foreground/30" : "bg-primary"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-150 ${
              compact ? "size-3" : "size-4"
            } ${inactive ? "" : compact ? "translate-x-3" : "translate-x-4"}`}
          />
        </span>
        {compact ? null : inactive ? "Inactive" : "Active"}
      </button>

      <Dialog open={confirming} onOpenChange={(open) => !pending && setConfirming(open)}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Make {name} Inactive?</DialogTitle>
          </DialogHeader>
          {/* Before → after (17 Nov): the same thing, switched off. */}
          <Handover
            ready
            tone="muted"
            from={
              <Side avatar={<Face name={name} />}>
                <span className="text-sm font-medium">{name}</span>
                <span className="text-xs text-success">Active</span>
              </Side>
            }
            to={
              <Side
                avatar={
                  <Settle delay>
                    <Face name={name} dimmed />
                  </Settle>
                }
              >
                <span className="text-sm font-medium text-muted-foreground">{name}</span>
                <span className="text-xs text-muted-foreground">Inactive</span>
              </Side>
            }
          />
          <DialogDescription className="text-center">{warning}</DialogDescription>
          <DialogFooter>
            <Button
              variant="outline"
              autoFocus
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button disabled={pending} onClick={() => save(false)}>
              {pending ? <Spinner className="size-4" /> : null}
              Make Inactive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * The admin's Active switch on an accounting manager or specialist (17 Nov).
 * Staff are never deleted (Sir, Q17). Making them Inactive never waits on
 * their work: their companies show Needs Reassignment until someone takes
 * them over.
 */
export function StaffActiveSwitch({
  userId,
  name,
  inactive,
  manager,
}: {
  userId: number;
  name: string;
  inactive: boolean;
  /** An accounting manager; a specialist otherwise. Says who reassigns. */
  manager: boolean;
}) {
  return (
    <ActiveSwitch
      name={name}
      inactive={inactive}
      warning={`${name} won’t be able to sign in or be assigned to anything. Their name stays on past work as “${name} (inactive)”. ${
        manager
          ? "Their companies need a new accounting manager, which you assign."
          : "Their companies need a new specialist, which each company’s accounting manager assigns."
      }`}
      onSave={(active) => adminApi.setUserActive(userId, active)}
    />
  );
}

/**
 * The owner's Active switch on Company Details (4 Nov decision).
 *
 * EXCEPT when nothing covers today (`mustPayToReactivate`): then the switch is
 * replaced by Complete Payment, and paying is what turns it back on (12 Nov
 * decision).
 *
 * The admin has the switch too (17 Nov). Their Make Active never switches the
 * company on by itself: it leaves a payment due with the owner, the same as an
 * unpaid company, and paying is what makes it active.
 */
export function CompanyActiveSwitch({
  companyId,
  name,
  inactive,
  mustPay = false,
  admin = false,
  compact,
}: {
  companyId: string;
  name: string;
  inactive: boolean;
  /** The owner's own bill; an admin has no checkout to be sent to. */
  mustPay?: boolean;
  admin?: boolean;
  compact?: boolean;
}) {
  if (admin) {
    return (
      <ActiveSwitch
        name={name}
        inactive={inactive}
        compact={compact}
        warning="Its projects, tasks, documents and chat are frozen: nobody — the customer’s team, the accounting manager or specialists — can open or download anything until it is active again. Nothing is deleted. Making it active again asks the owner to complete payment first."
        activeToast={`The owner has been asked to complete payment for ${name}.`}
        onSave={(active) => setCompanyActive(companyId, active)}
      />
    );
  }

  if (inactive && mustPay) {
    return (
      <Button asChild size="sm">
        <Link href={`/on_boarding_form_part_2?compID=${encodeURIComponent(companyId)}`}>
          Complete Payment
        </Link>
      </Button>
    );
  }

  return (
    <ActiveSwitch
      name={name}
      inactive={inactive}
      compact={compact}
      warning="Its projects, tasks, documents and chat are frozen: nobody — your team, your accounting manager or specialists — can open or download anything until you make it active again. Nothing is deleted."
      onSave={(active) => setCompanyActive(companyId, active)}
    />
  );
}

/** The creator's Active switch on a project page. */
export function ProjectActiveSwitch({
  projectId,
  name,
  inactive,
  compact,
}: {
  projectId: string;
  name: string;
  inactive: boolean;
  compact?: boolean;
}) {
  return (
    <ActiveSwitch
      name={name}
      inactive={inactive}
      compact={compact}
      warning="It moves to the Inactive tab, frozen: nobody can open its tasks or documents until you make it active again. Nothing is deleted."
      onSave={(active) => setProjectActive(projectId, active)}
    />
  );
}

/**
 * Mark Completed / Reopen on the accounting manager's project page (15 Nov).
 *
 * Completing asks once — it's the final confirmation, and the customer is told
 * to have a look. Reopening is immediate: it's how the customer's "this isn't
 * done" (asked in chat) gets answered, and it takes nothing away.
 */
export function ProjectCompletion({
  projectId,
  name,
  completed,
  openTasks,
}: {
  projectId: string;
  name: string;
  completed: boolean;
  /** Tasks not yet Completed — completing anyway is allowed, with a warning. */
  openTasks: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function save(status: "Completed" | "In progress") {
    setPending(true);
    try {
      await setProjectStatus(projectId, status);
      toast.success(
        status === "Completed" ? `${name} is completed.` : `${name} is reopened.`,
      );
      setConfirming(false);
      router.refresh();
    } catch (err) {
      toast.error(failure(err, `${name} could not be changed.`));
    } finally {
      setPending(false);
    }
  }

  if (completed) {
    return (
      <Button variant="outline" disabled={pending} onClick={() => save("In progress")}>
        {pending ? <Spinner className="size-4" /> : null}
        Reopen
      </Button>
    );
  }

  return (
    <>
      <Button onClick={() => setConfirming(true)}>Mark Completed</Button>

      <Dialog open={confirming} onOpenChange={(open) => !pending && setConfirming(open)}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Mark {name} Completed?</DialogTitle>
          </DialogHeader>
          <Handover
            ready
            from={
              <Side avatar={<Face name={name} />}>
                <span className="text-sm font-medium">{name}</span>
                <span className="text-xs text-muted-foreground">In progress</span>
              </Side>
            }
            to={
              <Side
                avatar={
                  <Settle delay>
                    <Face name={name} ringed />
                  </Settle>
                }
              >
                <span className="text-sm font-medium">{name}</span>
                <span className="text-xs text-success">Completed</span>
              </Side>
            }
          />
          <DialogDescription className="text-center">
            It moves to the Completed tab and is locked: no new tasks, uploads
            or status changes until you reopen it. The customer is asked to have
            a look.
          </DialogDescription>
          {openTasks > 0 && (
            <p className="text-center text-sm text-destructive">
              {openTasks} {openTasks === 1 ? "task is" : "tasks are"} still open.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              autoFocus
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button disabled={pending} onClick={() => save("Completed")}>
              {pending ? <Spinner className="size-4" /> : null}
              Mark Completed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Delete Company. Owner or admin.
 *
 * Deleting takes everything under the company, for everyone, and nothing
 * brings it back (Sir, Q5). Works from Active or Inactive — there is no forced
 * sequence.
 *
 * A header button beside the Active switch (17 Nov), as `DeleteProject` is —
 * not a red section at the foot.
 */
export function DeleteCompany({
  companyId,
  name,
  after,
}: {
  companyId: string;
  name: string;
  /** Where to go once it's gone. */
  after: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 aria-hidden />
        Delete
      </Button>
      <HoldDeleteDialog
        name={name}
        open={open}
        onOpenChange={setOpen}
        after={after}
        onDelete={() => deleteCompany(companyId)}
      >
        <CompanyDeleteWarning />
      </HoldDeleteDialog>
    </>
  );
}

/** What Delete Company takes. Both the owner and the admin can switch it off instead. */
function CompanyDeleteWarning() {
  return (
    <>
      <p>
        This permanently deletes the company with all of its projects, tasks,
        documents and chat, for everyone on it, including the accounting manager
        and specialist. It can’t be undone.
      </p>
      <p>To keep the records instead, make the company Inactive.</p>
    </>
  );
}

/**
 * The Companies table's Actions cell: Make Inactive / Active and Delete, with
 * the same popups as the company page (17 Nov). The caller decides who gets
 * it: the owner on their own list, the admin on theirs.
 *
 * `relative z-10` lifts the buttons over the row's stretched link, as in
 * `ProjectRowActions`.
 */
export function CompanyRowActions({
  company,
  mustPay,
  admin,
  children,
}: {
  company: { id: string; name: string; inactive: boolean };
  mustPay?: boolean;
  admin?: boolean;
  /** Actions that lead the row's own, e.g. admin's Reassign Accounting Manager. Delete stays last. */
  children?: React.ReactNode;
}) {
  const [deleting, setDeleting] = React.useState(false);
  return (
    <span className="relative z-10 flex items-center gap-1">
      {children}
      <CompanyActiveSwitch
        companyId={company.id}
        name={company.name}
        inactive={company.inactive}
        mustPay={mustPay}
        admin={admin}
        compact
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setDeleting(true)}
        aria-label={`Delete ${company.name}`}
        title="Delete"
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 aria-hidden />
      </Button>
      <HoldDeleteDialog
        name={company.name}
        open={deleting}
        onOpenChange={setDeleting}
        onDelete={() => deleteCompany(company.id)}
      >
        <CompanyDeleteWarning />
      </HoldDeleteDialog>
    </span>
  );
}

/**
 * Edit Project: name and deadline, in a popup. Creator only, like Inactive and
 * Delete (15 Nov) — the caller decides that.
 */
function EditProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: RowProject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const initial = { name: project.name, deadline: isoDate(project.deadline) };

  const form = useForm<EditProjectValues>({
    resolver: zodResolver(editProjectSchema),
    defaultValues: initial,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  async function onSubmit(values: EditProjectValues) {
    setError(null);
    const name = values.name.trim();
    try {
      await editProject(project, {
        ...(name !== project.name && { name }),
        ...(values.deadline !== initial.deadline && { deadline: values.deadline }),
      });
      onOpenChange(false);
      toast.success(`${name} saved.`);
      router.refresh();
    } catch (err) {
      setError(failure(err, `${project.name} could not be saved.`));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          form.reset(initial);
          setError(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
            <TextField
              control={form.control}
              name="name"
              label="Project Name"
              icon={FolderKanban}
              required
              autoFocus
            />
            <DateField
              control={form.control}
              name="deadline"
              label="Deadline"
              icon={CalendarDays}
              required
              min={tomorrow()}
            />
            <FormAlert>{error}</FormAlert>
            <SubmitButton pending={form.formState.isSubmitting}>Save</SubmitButton>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface RowProject {
  id: string;
  companyId: string;
  name: string;
  deadline: string;
  inactive: boolean;
}

/**
 * The Projects table's Actions cell: Make Inactive / Active, Edit, Delete —
 * the creator's three, with the same popups as the project page (15 Nov).
 * Anyone else gets an empty cell.
 *
 * `relative z-10` lifts the buttons over the row's stretched link, which
 * would otherwise swallow the click and open the project.
 */
export function ProjectRowActions({
  project,
  mine,
}: {
  project: RowProject;
  mine: boolean;
}) {
  const [dialog, setDialog] = React.useState<"edit" | "delete" | null>(null);
  if (!mine) return null;

  const close = (open: boolean) => !open && setDialog(null);
  return (
    <span className="relative z-10 flex items-center gap-1">
      <ProjectActiveSwitch
        projectId={project.id}
        name={project.name}
        inactive={project.inactive}
        compact
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setDialog("edit")}
        aria-label={`Edit ${project.name}`}
        title="Edit"
        className="text-muted-foreground"
      >
        <Pencil aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setDialog("delete")}
        aria-label={`Delete ${project.name}`}
        title="Delete"
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 aria-hidden />
      </Button>

      {dialog === "edit" && (
        <EditProjectDialog project={project} open onOpenChange={close} />
      )}
      <HoldDeleteDialog
        name={project.name}
        open={dialog === "delete"}
        onOpenChange={close}
        onDelete={() => deleteProject(project.id)}
      >
        <ProjectDeleteWarning />
      </HoldDeleteDialog>
    </span>
  );
}
