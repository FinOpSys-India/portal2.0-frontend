"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { managerApi, type Specialist } from "@/lib/manager";
import { cn } from "@/lib/utils";

/**
 * Routes an unassigned project to a specialist.
 *
 * Shows each specialist's current workload, because "who is free" is the only
 * question being asked at this moment and a bare name list cannot answer it.
 */
export function AssignSpecialist({
  projectId,
  projectName,
  specialists,
}: {
  projectId: string;
  projectName: string;
  specialists: Specialist[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);

  async function assign(email: string) {
    setFailure(null);
    setPending(email);
    try {
      await managerApi.assignSpecialist(projectId, email);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not assign.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="relative z-10">
          Assign
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {/* The project is in the title rather than a subheading below it:
              the trigger is one row of many, so the dialog still has to say
              which project it is about. */}
          <DialogTitle>Assign a specialist to {projectName}</DialogTitle>
        </DialogHeader>

        <ul className="space-y-2">
          {specialists.map((specialist) => (
            <li key={specialist.email}>
              <button
                type="button"
                onClick={() => assign(specialist.email)}
                disabled={pending !== null}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors duration-150",
                  "hover:border-primary/25 hover:bg-accent",
                  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
                  "disabled:pointer-events-none disabled:opacity-60",
                )}
              >
                <InitialsAvatar name={specialist.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {specialist.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {specialist.speciality}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {specialist.activeProjects === 0
                    ? "Free"
                    : `${specialist.activeProjects} active`}
                </span>
                {pending === specialist.email ? (
                  <Spinner className="size-4" aria-label="Assigning" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>

        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
