"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { SubmitButton } from "@/components/auth/fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { adminApi, type ManagerOption } from "@/lib/admin";

/**
 * The accounting manager on a company — assign, change, or remove.
 *
 * The only write admin has over company data, and it used to be a ONE-WAY DOOR:
 * the control rendered only where `accountingManager` was null, so a company
 * that had one could never be changed. A manager who left, or an assignment
 * made to the wrong account, had no route back through this screen — while
 * `PUT` (which replaces) and `DELETE` both existed on the backend the whole
 * time.
 *
 * So the current holder is now a button rather than plain text, and the dialog
 * carries both actions.
 */
export function AssignManager({
  companyId,
  managers,
  current,
}: {
  companyId: string;
  managers: ManagerOption[];
  /** The manager on the company today, or null when it has none. */
  current: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [manager, setManager] = React.useState("");
  const [pending, setPending] = React.useState<"save" | "remove" | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);

  async function run(
    action: "save" | "remove",
    write: () => Promise<void>,
    done: string,
  ) {
    setFailure(null);
    setPending(action);
    try {
      await write();
      setOpen(false);
      setManager("");
      toast.success(done);
      router.refresh();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(null);
    }
  }

  function onSave() {
    if (!manager) {
      setFailure("Pick a manager first.");
      return;
    }
    run(
      "save",
      () => adminApi.assignManager(companyId, Number(manager)),
      `${managers.find((m) => String(m.userId) === manager)?.name ?? "Accounting manager"} now manages this company.`,
    );
  }

  return (
    <>
      {/* Sits above the row link, so it needs its own stacking context to stay
          clickable. */}
      <Button
        variant={current ? "ghost" : "outline"}
        size="sm"
        onClick={() => setOpen(true)}
        className="relative z-10 -mx-2"
      >
        {current ?? "Assign"}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setManager("");
            setFailure(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {current ? "Change accounting manager" : "Assign accounting manager"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-2">
            {current ? (
              <p className="text-sm text-muted-foreground">
                Currently <span className="font-medium text-foreground">{current}</span>.
              </p>
            ) : null}

            <Label htmlFor="manager">Accounting manager</Label>
            <Select value={manager} onValueChange={setManager}>
              <SelectTrigger
                id="manager"
                className="h-11 w-full rounded-lg px-3.5 text-sm data-[size=default]:h-11"
              >
                <SelectValue placeholder="Select a manager" />
              </SelectTrigger>
              <SelectContent>
                {/* The VALUE is the user id — that is what the write takes.
                    Selecting by display name meant the id had to be looked up
                    again afterwards, by an email nobody had. */}
                {managers.map((m) => (
                  <SelectItem key={m.userId} value={String(m.userId)}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {failure ? (
              <p role="alert" className="text-sm text-destructive">
                {failure}
              </p>
            ) : null}
          </div>

          {/* Same 44px full-width action the invite dialogs use — this one is
              not inside a form, hence the explicit type. */}
          <SubmitButton
            type="button"
            onClick={onSave}
            pending={pending === "save"}
          >
            Save
          </SubmitButton>

          {/*
           * Only where there is something to remove. Says what it costs rather
           * than asking for a second confirmation: an unmanaged company has
           * nobody on the other side of its chat, so its customers and
           * specialists get NO_ACCOUNTING_MANAGER until one is assigned again.
           */}
          {current ? (
            <div className="border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={pending !== null}
                onClick={() =>
                  run(
                    "remove",
                    () => adminApi.removeManager(companyId),
                    "This company has no accounting manager now.",
                  )
                }
                className="w-full text-destructive hover:text-destructive"
              >
                {pending === "remove" ? "Removing…" : "Remove from this company"}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                The company keeps its projects and files, but nobody can chat
                with it until a manager is assigned again.
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
