"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Pencil } from "lucide-react";

import { SubmitButton, TextField, TextareaField } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { managerApi, type ProjectTask } from "@/lib/manager";
import { editTaskSchema, type EditTaskValues } from "@/lib/schemas";
import { specialistApi } from "@/lib/specialist";

/**
 * Which portal is editing. Named rather than passed as a function: the callers
 * are Server Components, and a function cannot cross that boundary.
 */
const EDIT = {
  manager: managerApi.editTask,
  specialist: specialistApi.editTask,
};

/**
 * Fix what a task SAYS — its name and its description — from the row itself.
 *
 * Deliberately not the deadline and not the project. A task's deadline is
 * bounded by its project's, which this dialog has no way to read, and the
 * project is what decides the assignee — moving a task between them is routing
 * work, not correcting a typo. Both stay with Add New Task, where the project's
 * own deadline is at hand.
 *
 * WHO: the company's accounting manager and the project's assigned specialist,
 * the same two the endpoint admits. The customer reads this table and gets no
 * trigger, which is why the callers gate on `from`.
 */
export function EditTask({
  task,
  from,
}: {
  task: Pick<ProjectTask, "id" | "name" | "description">;
  from: keyof typeof EDIT;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  const form = useForm<EditTaskValues>({
    resolver: zodResolver(editTaskSchema),
    defaultValues: { name: task.name, description: task.description },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  async function onSubmit(values: EditTaskValues) {
    setFailure(null);
    // Nothing typed is not a failed save — close, and spend no request on it.
    if (values.name === task.name && values.description === task.description) {
      setOpen(false);
      return;
    }
    try {
      await EDIT[from](task.id, values);
      setOpen(false);
      toast.success(`Task “${values.name}” updated.`);
      // The Edited badge is the server's answer, not this form's guess —
      // re-fetch rather than paint it on optimistically.
      router.refresh();
    } catch (err) {
      setFailure(
        err instanceof Error ? err.message : "Could not save that task.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFailure(null);
        }
        // Reset to the ROW's values, not the form's initial ones: a second open
        // after a successful save must show what was saved.
        form.reset({ name: task.name, description: task.description });
      }}
    >
      {/* DialogTrigger rather than a bare button: Radix returns focus here on
          close, which a row of these otherwise loses to the document. */}
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Edit “${task.name}”`}
        >
          <Pencil className="size-3.5" aria-hidden />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            <TextField
              control={form.control}
              name="name"
              label="Task Name"
              required
              autoFocus
              placeholder="Task name"
            />

            <TextareaField
              control={form.control}
              name="description"
              label="Description"
              required
              rows={3}
              placeholder="Describe task"
            />

            <FormAlert>{failure}</FormAlert>

            <SubmitButton pending={form.formState.isSubmitting}>
              Save
            </SubmitButton>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The marker beside a task that has been rewritten since it was filed.
 *
 * Its own export rather than a branch inside each table: both task tables and
 * the detail dialog show it, and a name cell that renders the name plus this is
 * the same two lines in three places.
 */
export function EditedBadge({ edited }: { edited: boolean }) {
  if (!edited) return null;

  return (
    <span className="ml-2 rounded-4xl bg-muted px-2 py-0.5 align-middle text-[11px] font-medium text-muted-foreground">
      Edited
    </span>
  );
}
