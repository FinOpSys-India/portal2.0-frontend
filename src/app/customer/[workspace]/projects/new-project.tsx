"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, FolderKanban, Plus, Wrench } from "lucide-react";
import { useForm } from "react-hook-form";

import {
  DateField,
  SelectField,
  SubmitButton,
  TextField,
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
import { customerApi } from "@/lib/customer";
import { newProjectSchema, type NewProjectValues } from "@/lib/schemas";

export function NewProject({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [services, setServices] = React.useState<string[] | null>(null);

  /*
   * FETCHED ON OPEN, not with the page.
   *
   * The service list used to arrive as a prop, which meant the Projects page
   * called `GET /projects/services` on every single view to fill a dialog that
   * is shut. Almost every visit to that page is someone reading their projects,
   * not creating one, so almost every one of those requests was wasted.
   *
   * This is the shape the manager's copy of this dialog already had
   * (src/app/manager/projects/new-project.tsx): nothing is asked for until the
   * reader opens the form.
   *
   * A FAILURE IS SAID OUT LOUD. Fetched with the page, a failure used to take
   * the page down with it, which at least told the reader something was wrong.
   * Moved in here it would otherwise be swallowed into an empty dropdown —
   * a form that looks complete, offers nothing to pick, and explains
   * nothing. So the error is surfaced where the reader is: in the dialog.
   */
  React.useEffect(() => {
    if (!open) return;

    let live = true;
    customerApi
      .availableServices(workspaceId)
      .then((rows) => {
        if (live) setServices(rows);
      })
      .catch(() => {
        if (!live) return;
        setServices([]);
        setFailure("Could not load the list of services. Close this and try again.");
      });

    return () => {
      live = false;
    };
  }, [open, workspaceId]);

  const form = useForm<NewProjectValues>({
    resolver: zodResolver(newProjectSchema),
    defaultValues: { name: "", service: "", deadline: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  async function onSubmit(values: NewProjectValues) {
    setFailure(null);
    try {
      await customerApi.createProject(workspaceId, values);
      setOpen(false);
      form.reset();
      toast.success(`Project “${values.name}” created.`);
      router.refresh();
    } catch (err) {
      setFailure(
        err instanceof Error ? err.message : "Could not create the project.",
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
        <Button>
          <Plus className="size-4" aria-hidden />
          New Project
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
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
              label="Project Name"
              icon={FolderKanban}
              required
              autoFocus
              placeholder="e.g. August payroll run"
            />

            {/* Every active service, not just Payroll — see customerApi. */}
            <SelectField
              control={form.control}
              name="service"
              label="Service"
              icon={Wrench}
              required
              placeholder="Select a service"
              options={services ?? []}
            />

            <DateField
              control={form.control}
              name="deadline"
              label="Deadline"
              icon={CalendarDays}
              required
              // 1.0 blocks today as well as the past; the first selectable day
              // is tomorrow.
              min={tomorrow()}
            />

            <FormAlert>{failure}</FormAlert>

            <SubmitButton pending={form.formState.isSubmitting}>
              Create Project
            </SubmitButton>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}
