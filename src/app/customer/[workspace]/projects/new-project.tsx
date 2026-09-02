"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, FolderKanban, Plus, Wrench } from "lucide-react";
import { useForm } from "react-hook-form";

import { SelectField, SubmitButton, TextField } from "@/components/auth/fields";
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

export function NewProject({
  workspaceId,
  services,
}: {
  workspaceId: string;
  services: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

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
          New project
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
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
              options={services}
            />

            <TextField
              control={form.control}
              name="deadline"
              label="Deadline"
              icon={CalendarDays}
              required
              type="date"
              // 1.0 blocks today as well as the past; the first selectable day
              // is tomorrow. Same rule, stated in the field rather than
              // discovered by clicking a disabled cell.
              min={tomorrow()}
            />

            <FormAlert>{failure}</FormAlert>

            <SubmitButton pending={form.formState.isSubmitting}>
              Create project
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
