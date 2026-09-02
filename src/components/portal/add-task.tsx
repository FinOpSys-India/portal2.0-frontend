"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  SelectField,
  StaticField,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/auth/fields";
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
import { managerApi } from "@/lib/manager";
import { newTaskSchema, type NewTaskValues } from "@/lib/schemas";
import { specialistApi } from "@/lib/specialist";

/**
 * Which portal is adding. Named rather than passed as a function: the callers
 * are Server Components, and a function cannot cross that boundary.
 */
const ADD = {
  manager: managerApi.addTask,
  specialist: specialistApi.addTask,
};

/**
 * Add New Task — 1.0's four fields: name, description, deadline, and the
 * project.
 *
 * One project in the list means the caller is a project page, where 1.0 shows
 * a select holding a single option; it renders as static text instead. More
 * than one and the field is a real choice — the specialist's page lists every
 * project they are on.
 *
 * No assignee, matching 1.0. That means a task cannot be routed to anyone from
 * here; the portal's only assignment surface is company-level, on the
 * Companies row. Recorded in docs/am-portal.md rather than quietly fixed.
 */
export function AddTask({
  projects,
  from,
}: {
  projects: { id: string; name: string }[];
  from: keyof typeof ADD;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  const only = projects.length === 1 ? projects[0] : null;

  const form = useForm<NewTaskValues>({
    resolver: zodResolver(newTaskSchema),
    defaultValues: {
      name: "",
      description: "",
      deadline: "",
      projectId: only?.id ?? "",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  async function onSubmit({ projectId, ...task }: NewTaskValues) {
    setFailure(null);
    try {
      await ADD[from](projectId, task);
      setOpen(false);
      form.reset();
      toast.success(`Task “${task.name}” added.`);
      // The new row lives on the server; re-fetch rather than guess at it.
      router.refresh();
    } catch (err) {
      setFailure(
        err instanceof Error ? err.message : "Could not add the task.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          form.reset();
          setFailure(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">Add New Task</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add new task</DialogTitle>
        </DialogHeader>

        {projects.length === 0 ? (
          // A task hangs off a project, so with none there is nothing to file
          // against. Said here rather than by disabling the trigger: a dead
          // button is the same dead end without the reason.
          <p className="text-sm text-muted-foreground">
            You have no projects at this company yet. A task is filed against a
            project, so there is nothing to add one to.
          </p>
        ) : (
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

              {/* Native date input rather than a picker library: it validates,
                localises and is keyboard-accessible for free. 1.0 uses
                pickadate.js, whose overlay breaks its own modal layout. */}
              <TextField
                control={form.control}
                name="deadline"
                label="Deadline Date"
                required
                type="date"
              />

              {only ? (
                <StaticField label="Project" value={only.name} />
              ) : (
                <SelectField
                  control={form.control}
                  name="projectId"
                  label="Project"
                  required
                  placeholder="Select a project"
                  options={projects.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                />
              )}

              <FormAlert>{failure}</FormAlert>

              <SubmitButton pending={form.formState.isSubmitting}>
                Submit
              </SubmitButton>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
