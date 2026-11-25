"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { SubmitButton, TextareaField } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { StatusBadge } from "@/components/portal/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/http";
import { managerApi, type TaskStatus } from "@/lib/manager";
import { taskMoves, type TaskMove } from "@/lib/portal";
import {
  requiredReviewNoteSchema,
  reviewNoteSchema,
  type ReviewNoteValues,
} from "@/lib/schemas";
import { specialistApi } from "@/lib/specialist";

/**
 * The status badge, clickable when the reader has a move to make — moving a
 * task on is the one thing this screen exists to do.
 *
 * The menu offers only what `PATCH /tasks/:id/status` accepts from this
 * person and this state (`taskMoves`, the review flow of 25 Nov). With nothing
 * to offer — a specialist's task in review, or any task in an inactive
 * project — it's a plain badge, not a menu with no items.
 */
export function TaskStatusMenu({
  taskId,
  name,
  status,
  from,
  locked = false,
}: {
  taskId: string;
  /** Named in the review popup. */
  name: string;
  status: TaskStatus;
  /** Which portal is moving the task. */
  from: "manager" | "specialist";
  /** In an inactive project: read, not moved. */
  locked?: boolean;
}) {
  const router = useRouter();
  const trigger = React.useRef<HTMLButtonElement>(null);
  const [pending, setPending] = React.useState(false);
  const [asking, setAsking] = React.useState<TaskMove | null>(null);

  const moves = locked ? [] : taskMoves(from, status);

  const save = (to: TaskStatus, note?: string) =>
    from === "manager"
      ? managerApi.setTaskStatus(taskId, to, note)
      : specialistApi.setTaskStatus(taskId, to);

  async function move(to: TaskStatus) {
    if (pending) return;
    setPending(true);
    try {
      await save(to);
      router.refresh();
    } catch (err) {
      // A badge is not a form — there is nowhere in this menu to put a
      // message, so a failed move used to leave the old status on screen and
      // say nothing, which reads as a click that did not register.
      toast.error(
        err instanceof Error ? err.message : "Could not move that task.",
      );
    } finally {
      setPending(false);
    }
  }

  if (moves.length === 0) return <StatusBadge status={status} />;

  return (
    <>
      {/* Not modal: a modal menu that closes into a dialog can leave the page
          unclickable behind it. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          ref={trigger}
          disabled={pending}
          className="rounded-4xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-60"
          aria-label={`Status: ${status}. Change it.`}
        >
          <StatusBadge status={status} chevron />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {moves.map((option) => (
            <DropdownMenuItem
              key={option.label}
              onSelect={() => (option.note ? setAsking(option) : move(option.to))}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {asking ? (
        <ReviewDialog
          move={asking}
          name={name}
          onClose={() => setAsking(null)}
          onSave={async (note) => {
            await save(asking.to, note || undefined);
            toast.success(
              asking.to === "Completed"
                ? `${name} is completed.`
                : `${name} is back in progress.`,
            );
            router.refresh();
          }}
          returnFocus={() => trigger.current?.focus()}
        />
      ) : null}
    </>
  );
}

/**
 * Approve, Send Back or Reopen, with the note the specialist reads on the
 * task. Required for the two that send work back, optional to approve.
 */
function ReviewDialog({
  move,
  name,
  onClose,
  onSave,
  returnFocus,
}: {
  move: TaskMove;
  name: string;
  onClose: () => void;
  onSave: (note: string) => Promise<void>;
  returnFocus: () => void;
}) {
  const required = move.note === "required";
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<ReviewNoteValues>({
    resolver: zodResolver(required ? requiredReviewNoteSchema : reviewNoteSchema),
    defaultValues: { note: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const submitting = form.formState.isSubmitting;

  async function onSubmit({ note }: ReviewNoteValues) {
    setError(null);
    try {
      await onSave(note);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.fields?.note) {
        form.setError("note", { message: err.fields.note }, { shouldFocus: true });
      } else {
        setError(
          err instanceof Error && err.message
            ? err.message
            : `${name} could not be moved.`,
        );
      }
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={!submitting}
        // The menu item that opened this is gone; the badge is what's left.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{move.label} Task</DialogTitle>
          <DialogDescription>
            {required
              ? `${name} goes back to In progress. Tell the specialist what needs to change.`
              : `${name} moves to Completed. A note for the specialist is optional.`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
            <TextareaField
              control={form.control}
              name="note"
              label={required ? "Note" : "Note (optional)"}
              required={required}
              maxLength={2000}
              autoFocus
            />
            <FormAlert>{error}</FormAlert>
            <SubmitButton pending={submitting}>{move.label}</SubmitButton>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The accounting manager's latest review note, in a task's detail popup.
 * Staff only: it's between the accounting manager and the specialist.
 */
export function ReviewNoteRow({
  review,
}: {
  review: { note: string; by: string; on: string } | null;
}) {
  if (!review) return null;
  return (
    <div>
      <dt className="text-sm text-muted-foreground">Review Note</dt>
      <dd className="mt-0.5 text-sm whitespace-pre-line wrap-anywhere">
        {review.note}
      </dd>
      <dd className="mt-1 text-xs text-muted-foreground">
        {[review.by, review.on].filter(Boolean).join(" · ")}
      </dd>
    </div>
  );
}
